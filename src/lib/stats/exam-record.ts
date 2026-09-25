import { z } from "zod";

import type { Semester } from "./semester";

export const EXAM_SOURCES = ["aamin", "tum_info", "upload"] as const;
export type ExamSource = (typeof EXAM_SOURCES)[number];
export type ExamType = "endterm" | "retake";

/**
 * The normalised shape every importer/parser produces. It is stored as-is in
 * `source_records.data` and merged into the public `exams` table.
 */
export const examRecordSchema = z.object({
  moduleCode: z.string().regex(/^[A-Z]{2,5}[0-9][A-Z0-9_-]*$/),
  moduleName: z.string().min(1).optional(),
  moduleNameLang: z.enum(["en", "de"]).optional(),
  ects: z.number().positive().optional(),
  semester: z.string().regex(/^\d{4}(WS|SS)$/),
  type: z.enum(["endterm", "retake"]),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  registered: z.number().int().nonnegative().optional(),
  attempted: z.number().int().nonnegative().optional(),
  noShow: z.number().int().nonnegative().optional(),
  withdrawn: z.number().int().nonnegative().optional(),
  cheating: z.number().int().nonnegative().optional(),
  /** As reported by the source; recomputed from `grades` when a distribution is present. */
  averageTotal: z.number().optional(),
  averagePassed: z.number().optional(),
  failureRate: z.number().min(0).max(1).optional(),
  grades: z.record(z.string().regex(/^([1-5]\.\d|B|N)$/), z.number().int().nonnegative()),
});

export type ExamRecord = z.infer<typeof examRecordSchema> & { semester: Semester };

export function examKey(r: Pick<ExamRecord, "moduleCode" | "semester" | "type">): string {
  return `${r.moduleCode}/${r.semester}/${r.type}`;
}
