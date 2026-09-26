import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/*
 * Club/application data model against a real Postgres (opt-in via TEST_DATABASE_URL, like
 * src/importers/store.integration.test.ts).
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("clubs & retention (integration)", () => {
  let mod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let orm: typeof import("drizzle-orm");
  let retention: typeof import("@/lib/retention");
  let clubStore: typeof import("@/importers/clubs/store");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    mod = await import("@/db");
    schema = await import("@/db/schema");
    orm = await import("drizzle-orm");
    retention = await import("@/lib/retention");
    clubStore = await import("@/importers/clubs/store");
    // Migrations are applied once in vitest.global-setup.ts.
  });

  beforeEach(async () => {
    await mod.db.execute(orm.sql`truncate applications, club_forms, club_claims, club_members, clubs, sessions, login_tokens, users restart identity cascade`);
  });

  afterAll(async () => {
    await mod?.pgClient.end();
  });

  const gallery = (name: string, extra: Partial<import("@/importers/clubs/store").ImportedClub> = {}) => ({
    name,
    description: `About ${name}`,
    focusAreas: ["Technology & Research"],
    website: null,
    imageUrl: null,
    locations: ["Garching"],
    ...extra,
  });

  it("imports clubs, keeps club-edited fields and unlists vanished clubs", async () => {
    await clubStore.saveGalleryClubs(mod.db, [gallery("Akaflieg"), gallery("Robo Team")]);
    await mod.db
      .update(schema.clubs)
      .set({ description: "Our own text", website: "https://own.example" })
      .where(orm.eq(schema.clubs.name, "Akaflieg"));
    const res = await clubStore.saveGalleryClubs(mod.db, [gallery("Akaflieg", { website: "https://tum.example", description: "New TUM text" })]);
    expect(res).toMatchObject({ total: 1, created: 0, unlisted: 1 });
    const [a] = await mod.db.select().from(schema.clubs).where(orm.eq(schema.clubs.name, "Akaflieg"));
    expect(a).toMatchObject({ description: "Our own text", website: "https://own.example", sourceDescription: "New TUM text", slug: "akaflieg" });
    const [r] = await mod.db.select().from(schema.clubs).where(orm.eq(schema.clubs.name, "Robo Team"));
    expect(r.listed).toBe(false);
  });

  it("allows one application per form and user, and deleting a user removes their data", async () => {
    await clubStore.saveGalleryClubs(mod.db, [gallery("Akaflieg")]);
    const [club] = await mod.db.select().from(schema.clubs);
    const [user] = await mod.db.insert(schema.users).values({ email: "ge12abc@mytum.de" }).returning();
    const [form] = await mod.db.insert(schema.clubForms).values({ clubId: club.id, title: "Join", status: "open" }).returning();
    const values = { formId: form.id, clubId: club.id, userId: user.id, applicantName: "Max", applicantEmail: user.email, answers: {} };
    await mod.db.insert(schema.applications).values(values);
    const dup = await mod.db.insert(schema.applications).values(values).onConflictDoNothing().returning();
    expect(dup).toHaveLength(0);

    await mod.db.delete(schema.users).where(orm.eq(schema.users.id, user.id));
    expect(await mod.db.select().from(schema.applications)).toHaveLength(0);
  });

  it("purges applications after 6 months and expired tokens/sessions", async () => {
    await clubStore.saveGalleryClubs(mod.db, [gallery("Akaflieg")]);
    const [club] = await mod.db.select().from(schema.clubs);
    const [user] = await mod.db.insert(schema.users).values({ email: "a@tum.de" }).returning();
    const [form] = await mod.db.insert(schema.clubForms).values({ clubId: club.id, title: "Join" }).returning();
    const [user2] = await mod.db.insert(schema.users).values({ email: "b@tum.de" }).returning();
    const now = new Date("2027-06-01T00:00:00Z");
    await mod.db.insert(schema.applications).values([
      { formId: form.id, clubId: club.id, userId: user.id, applicantName: "Old", applicantEmail: "a@tum.de", answers: {}, createdAt: new Date("2026-11-01T00:00:00Z") },
      { formId: form.id, clubId: club.id, userId: user2.id, applicantName: "New", applicantEmail: "b@tum.de", answers: {}, createdAt: new Date("2027-01-15T00:00:00Z") },
    ]);
    await mod.db.insert(schema.loginTokens).values({ tokenHash: "x", email: "a@tum.de", expiresAt: new Date("2027-05-01T00:00:00Z"), createdAt: new Date("2027-05-01T00:00:00Z") });
    await mod.db.insert(schema.sessions).values({ idHash: "s", userId: user.id, expiresAt: new Date("2027-05-31T00:00:00Z") });

    const res = await retention.purgeExpiredData(mod.db, now);
    expect(res).toMatchObject({ applications: 1, loginTokens: 1, sessions: 1 });
    const left = await mod.db.select().from(schema.applications);
    expect(left.map((a) => a.applicantName)).toEqual(["New"]);
  });
});
