import { describe, expect, it } from "vitest";

import { recentSemesters, reviewInputFromFormData, summarizeReviews } from "./reviews";

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

describe("recentSemesters", () => {
  it("starts with the running semester", () => {
    expect(recentSemesters(new Date("2026-05-10"), 3)).toEqual(["2026SS", "2025WS", "2025SS"]);
    expect(recentSemesters(new Date("2026-11-10"), 2)).toEqual(["2026WS", "2026SS"]);
    // January–March still belongs to the winter semester that started the previous year.
    expect(recentSemesters(new Date("2027-02-01"), 2)).toEqual(["2026WS", "2026SS"]);
  });
});

describe("reviewInputFromFormData", () => {
  it("parses ratings, yes/no answers and trims the comment", () => {
    const res = reviewInputFromFormData(
      form({ semester: "2025WS", usefulness: "4", difficulty: "2", workload: "3", attendanceRequired: "no", lecturesRecorded: "", comment: "  Great tutorials. " }),
    );
    expect(res.success && res.data).toEqual({
      semester: "2025WS",
      usefulness: 4,
      difficulty: 2,
      workload: 3,
      attendanceRequired: false,
      lecturesRecorded: null,
      comment: "Great tutorials.",
    });
  });

  it("requires every rating", () => {
    const res = reviewInputFromFormData(form({ semester: "2025WS", usefulness: "4", difficulty: "2" }));
    expect(res.success).toBe(false);
    expect(res.error?.issues[0].message).toBe("Please rate every question.");
  });

  it("rejects out-of-range ratings and empty comments become null", () => {
    expect(reviewInputFromFormData(form({ semester: "2025WS", usefulness: "6", difficulty: "2", workload: "3" })).success).toBe(false);
    const res = reviewInputFromFormData(form({ semester: "2025WS", usefulness: "1", difficulty: "1", workload: "1", comment: "   " }));
    expect(res.success && res.data.comment).toBeNull();
  });
});

describe("summarizeReviews", () => {
  const row = (id: number, semester: string, u: number, d: number, w: number, extra: Partial<Parameters<typeof summarizeReviews>[0][number]> = {}) => ({
    id,
    semester,
    usefulness: u,
    difficulty: d,
    workload: w,
    attendanceRequired: null,
    lecturesRecorded: null,
    comment: null,
    commentStatus: null,
    ...extra,
  });
  const rows = [
    row(1, "2025SS", 5, 4, 4, { attendanceRequired: true, comment: "Hard but fair", commentStatus: "approved" }),
    row(2, "2025WS", 3, 2, 3, { attendanceRequired: false, lecturesRecorded: true, comment: "Pending", commentStatus: "pending" }),
    row(3, "2025WS", 4, 3, 2, { comment: "Rejected", commentStatus: "rejected" }),
  ];

  it("averages ratings and counts yes answers among those who answered", () => {
    const s = summarizeReviews(rows);
    expect(s.count).toBe(3);
    expect(s.averages).toEqual({ usefulness: 4, difficulty: 3, workload: 3 });
    expect(s.attendanceRequired).toEqual({ yes: 1, answered: 2 });
    expect(s.lecturesRecorded).toEqual({ yes: 1, answered: 1 });
    expect(s.semesters).toEqual(["2025WS", "2025SS"]);
  });

  it("only shows approved comments", () => {
    expect(summarizeReviews(rows).comments.map((c) => c.comment)).toEqual(["Hard but fair"]);
  });

  it("filters by semester", () => {
    const s = summarizeReviews(rows, "2025WS");
    expect(s.count).toBe(2);
    expect(s.averages.usefulness).toBe(3.5);
    expect(s.semesters).toEqual(["2025WS", "2025SS"]);
  });

  it("has no averages without reviews", () => {
    expect(summarizeReviews([]).averages).toEqual({ usefulness: null, difficulty: null, workload: null });
  });
});
