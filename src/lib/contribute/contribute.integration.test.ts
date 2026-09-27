import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/*
 * Statistics uploads and module reviews against a real Postgres (opt-in via TEST_DATABASE_URL,
 * like src/importers/store.integration.test.ts).
 */
const url = process.env.TEST_DATABASE_URL;
const fixture = readFileSync(path.join(__dirname, "../../importers/__fixtures__/tumonline-exam-statistics.en.html"), "utf8");

describe.skipIf(!url)("uploads & reviews (integration)", () => {
  let mod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let orm: typeof import("drizzle-orm");
  let subs: typeof import("./submissions");
  let reviews: typeof import("@/lib/reviews/reviews");
  let retention: typeof import("@/lib/retention");
  let store: typeof import("@/importers/store");
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    mod = await import("@/db");
    schema = await import("@/db/schema");
    orm = await import("drizzle-orm");
    subs = await import("./submissions");
    reviews = await import("@/lib/reviews/reviews");
    retention = await import("@/lib/retention");
    store = await import("@/importers/store");
  });

  beforeEach(async () => {
    await mod.db.execute(
      orm.sql`truncate module_reviews, submissions, grade_counts, source_records, exams, module_names, modules, sessions, users restart identity cascade`,
    );
    const [a, b] = await mod.db
      .insert(schema.users)
      .values([{ email: "alice@tum.de" }, { email: "bob@tum.de" }])
      .returning({ id: schema.users.id });
    alice = a.id;
    bob = b.id;
  });

  afterAll(async () => {
    await mod?.pgClient.end();
  });

  const tamper = (from: string, to: string) => fixture.replace(`data-unformatted="${from}"`, `data-unformatted="${to}"`);

  describe("uploads", () => {
    it("stores only the parsed numbers, pending and linked to the uploader", async () => {
      const res = await subs.createSubmission(mod.db, alice, fixture, "endterm");
      expect(res.status).toBe("submitted");
      const [row] = await mod.db.select().from(schema.submissions);
      expect(row).toMatchObject({ status: "pending", userId: alice, moduleCode: "WI001057", semester: "2025SS", type: "endterm" });
      expect(JSON.stringify(row)).not.toContain("Mustermann");
      expect(JSON.stringify(row)).not.toContain("<");
    });

    it("replaces one's own pending upload and skips numbers someone else already sent", async () => {
      await subs.createSubmission(mod.db, alice, fixture, "endterm");
      expect((await subs.createSubmission(mod.db, alice, fixture, "endterm")).status).toBe("updated");
      expect((await subs.createSubmission(mod.db, bob, fixture, "endterm")).status).toBe("duplicate");
      // Different numbers from someone else are queued separately for the reviewer.
      expect((await subs.createSubmission(mod.db, bob, tamper("7.15% #64", "7.15% #65"), "endterm")).status).toBe("submitted");
      expect(await subs.countPendingSubmissions(mod.db)).toBe(2);
    });

    it("publishes on approval, unlinks the uploader and closes identical uploads", async () => {
      const { id } = await subs.createSubmission(mod.db, alice, fixture, "endterm");
      // Same numbers but filed as retake by someone else: a different exam, stays pending.
      await subs.createSubmission(mod.db, bob, fixture, "retake");
      await subs.approveSubmission(mod.db, id!);

      const [exam] = await mod.db.select().from(schema.exams);
      expect(exam).toMatchObject({ semester: "2025SS", type: "endterm", attempted: 895, status: "published", sources: ["upload"] });
      const rows = await mod.db.select().from(schema.submissions).orderBy(schema.submissions.createdAt);
      expect(rows.find((r) => r.id === id)).toMatchObject({ status: "approved", userId: null });
      expect(rows.find((r) => r.id !== id)).toMatchObject({ status: "pending", type: "retake" });

      expect((await subs.createSubmission(mod.db, bob, fixture, "endterm")).status).toBe("known");
      const key = { moduleCode: "WI001057", semester: "2025SS", type: "endterm" } as const;
      expect(await subs.compareWithPublished(mod.db, key, subs.parseUpload(fixture).record.grades)).toMatchObject({ state: "same" });
    });

    it("marks conflicting numbers from another source instead of overwriting them", async () => {
      const { record } = subs.parseUpload(fixture);
      await store.saveSourceRecords(mod.db, "tum_info", [{ ...record, grades: { ...record.grades, "1.0": 1 } }]);
      const { id } = await subs.createSubmission(mod.db, alice, fixture, "endterm");
      const [pending] = await subs.listPendingSubmissions(mod.db);
      expect(pending.comparison.state).toBe("different");
      await subs.approveSubmission(mod.db, id!);
      const [exam] = await mod.db.select().from(schema.exams);
      expect(exam.status).toBe("conflict");
    });

    it("rejects, withdraws and purges reviewed uploads after the retention period", async () => {
      const { id } = await subs.createSubmission(mod.db, alice, fixture, "endterm");
      await subs.rejectSubmission(mod.db, id!, "Wrong semester");
      await expect(subs.rejectSubmission(mod.db, id!)).rejects.toThrow(subs.UploadError);
      const [row] = await mod.db.select().from(schema.submissions);
      expect(row).toMatchObject({ status: "rejected", userId: null, reviewNote: "Wrong semester" });

      const other = await subs.createSubmission(mod.db, bob, fixture, "retake");
      await subs.withdrawSubmission(mod.db, alice, other.id!); // not Alice's: no effect
      expect(await subs.listMySubmissions(mod.db, bob)).toHaveLength(1);
      await subs.withdrawSubmission(mod.db, bob, other.id!);
      expect(await subs.listMySubmissions(mod.db, bob)).toHaveLength(0);

      const later = new Date(Date.now() + 200 * 24 * 3600 * 1000);
      const res = await retention.purgeExpiredData(mod.db, later);
      expect(res.submissions).toBe(1);
    });

    it("keeps anonymous pending uploads when the uploader deletes their account", async () => {
      await subs.createSubmission(mod.db, alice, fixture, "endterm");
      await mod.db.delete(schema.users).where(orm.eq(schema.users.id, alice));
      const [row] = await mod.db.select().from(schema.submissions);
      expect(row).toMatchObject({ status: "pending", userId: null });
    });
  });

  describe("reviews", () => {
    let moduleId: number;
    beforeEach(async () => {
      const [m] = await mod.db.insert(schema.modules).values({ code: "IN0001", nameEn: "Intro" }).returning({ id: schema.modules.id });
      moduleId = m.id;
    });

    const input = (extra: Partial<import("@/lib/reviews/reviews").ReviewInput> = {}) => ({
      semester: "2025WS",
      usefulness: 4,
      difficulty: 3,
      workload: 5,
      attendanceRequired: null,
      lecturesRecorded: true,
      comment: null,
      ...extra,
    });

    it("keeps one review per user, module and semester", async () => {
      expect((await reviews.saveReview(mod.db, alice, moduleId, input())).created).toBe(true);
      expect((await reviews.saveReview(mod.db, alice, moduleId, input({ usefulness: 2 }))).created).toBe(false);
      await reviews.saveReview(mod.db, alice, moduleId, input({ semester: "2025SS" }));
      await reviews.saveReview(mod.db, bob, moduleId, input({ usefulness: 5 }));
      const s = await reviews.getModuleReviewSummary(mod.db, moduleId, "2025WS");
      expect(s.count).toBe(2);
      expect(s.averages.usefulness).toBe(3.5);
    });

    it("shows comments only after approval and re-reviews edited comments", async () => {
      const { id } = await reviews.saveReview(mod.db, alice, moduleId, input({ comment: "Nice" }));
      expect((await reviews.getModuleReviewSummary(mod.db, moduleId)).comments).toHaveLength(0);
      expect(await reviews.moderateComments(mod.db, [id], "approved")).toEqual(["IN0001"]);
      expect((await reviews.getModuleReviewSummary(mod.db, moduleId)).comments.map((c) => c.comment)).toEqual(["Nice"]);

      // Changing only the ratings keeps the approval; editing the text sends it back to review.
      await reviews.saveReview(mod.db, alice, moduleId, input({ comment: "Nice", workload: 1 }));
      expect((await reviews.getModuleReviewSummary(mod.db, moduleId)).comments).toHaveLength(1);
      await reviews.saveReview(mod.db, alice, moduleId, input({ comment: "Nice!" }));
      expect((await reviews.getModuleReviewSummary(mod.db, moduleId)).comments).toHaveLength(0);
      expect(await reviews.countPendingComments(mod.db)).toBe(1);
      await reviews.saveReview(mod.db, alice, moduleId, input());
      expect(await reviews.countPendingComments(mod.db)).toBe(0);
    });

    it("never exposes who wrote a review and deletes reviews with the account", async () => {
      const { id } = await reviews.saveReview(mod.db, alice, moduleId, input({ comment: "Hi" }));
      await reviews.moderateComments(mod.db, [id], "approved");
      const s = await reviews.getModuleReviewSummary(mod.db, moduleId);
      expect(JSON.stringify(s)).not.toContain(alice);

      await reviews.deleteReview(mod.db, bob, id); // not Bob's
      expect(await reviews.getMyReviews(mod.db, alice)).toHaveLength(1);
      await mod.db.delete(schema.users).where(orm.eq(schema.users.id, alice));
      expect((await reviews.getModuleReviewSummary(mod.db, moduleId)).count).toBe(0);
    });

    it("rejects out-of-range ratings at the database level", async () => {
      await expect(reviews.saveReview(mod.db, alice, moduleId, input({ difficulty: 7 }))).rejects.toThrow();
    });
  });
});
