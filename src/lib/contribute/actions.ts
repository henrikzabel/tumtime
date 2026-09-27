"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { getCurrentUser, requireAdmin, requireUser } from "@/lib/auth/session";
import type { ExamRecord, ExamType } from "@/lib/stats/exam-record";

import {
  approveSubmission,
  compareWithPublished,
  createSubmission,
  parseUpload,
  rejectSubmission,
  UploadError,
  withdrawSubmission,
  type PublishedComparison,
} from "./submissions";

export type PreviewState =
  | { ok: true; record: ExamRecord; examCode: string; typeGuess: ExamType; warnings: string[]; comparison: PublishedComparison }
  | { ok: false; error: string };

export type SubmitState = { ok: boolean; message?: string; error?: string };

const asType = (v: unknown): ExamType | null => (v === "endterm" || v === "retake" ? v : null);

function errorMessage(err: unknown): string {
  if (err instanceof UploadError) return err.message;
  console.error("Upload failed:", err);
  return "Something went wrong while reading the page. Please try again.";
}

/** Parse the statistics block and show what would be stored. Nothing is saved. */
export async function previewUpload(fragment: string): Promise<PreviewState> {
  if (!(await getCurrentUser())) return { ok: false, error: "Please sign in first." };
  try {
    const preview = parseUpload(fragment);
    const comparison = await compareWithPublished(db, preview.record, preview.record.grades);
    return { ok: true, ...preview, comparison };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function submitUpload(fragment: string, type: string): Promise<SubmitState> {
  const user = await requireUser("/contribute");
  const examType = asType(type);
  if (!examType) return { ok: false, error: "Please choose whether this was the end-of-term exam or the retake." };
  try {
    const res = await createSubmission(db, user.id, fragment, examType);
    revalidatePath("/me");
    switch (res.status) {
      case "known":
        return { ok: true, message: "We already publish exactly these numbers — thank you anyway!" };
      case "duplicate":
        return { ok: true, message: "Someone already uploaded these numbers; they're waiting for review. Thank you!" };
      case "updated":
        return { ok: true, message: "Your earlier upload for this exam was replaced. It will go live once it's reviewed." };
      default:
        return { ok: true, message: "Thank you! Your upload will go live once it's reviewed." };
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function withdrawUpload(formData: FormData) {
  const user = await requireUser("/me");
  await withdrawSubmission(db, user.id, String(formData.get("submissionId")));
  revalidatePath("/me");
}

export async function reviewSubmission(formData: FormData) {
  await requireAdmin("/admin/submissions");
  const id = String(formData.get("submissionId"));
  if (formData.get("decision") === "approve") {
    await approveSubmission(db, id, asType(formData.get("type")) ?? undefined);
    const code = String(formData.get("moduleCode") ?? "");
    if (code) revalidatePath(`/modules/${code}`);
    revalidatePath("/browse");
  } else {
    await rejectSubmission(db, id, String(formData.get("note") ?? ""));
  }
  revalidatePath("/admin/submissions");
}
