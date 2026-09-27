"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { modules } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/clubs/actions";

import { deleteReview, moderateComments, recentSemesters, reviewInputFromFormData, saveReview } from "./reviews";

export async function submitReview(moduleCode: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(`/modules/${moduleCode}/review`);
  const parsed = reviewInputFromFormData(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!recentSemesters().includes(parsed.data.semester as never)) {
    return { error: "Please choose one of the listed semesters." };
  }
  const [mod] = await db.select({ id: modules.id }).from(modules).where(eq(modules.code, moduleCode));
  if (!mod) return { error: "Module not found." };

  const { created } = await saveReview(db, user.id, mod.id, parsed.data);
  revalidatePath(`/modules/${moduleCode}`);
  revalidatePath(`/modules/${moduleCode}/review`);
  const note = parsed.data.comment ? " Your comment will appear once it's been checked." : "";
  return { ok: true, message: `${created ? "Thanks for your review!" : "Review updated."}${note}` };
}

export async function removeReview(formData: FormData) {
  const user = await requireUser("/me");
  await deleteReview(db, user.id, Number(formData.get("reviewId")));
  const code = String(formData.get("moduleCode") ?? "");
  if (code) {
    revalidatePath(`/modules/${code}`);
    revalidatePath(`/modules/${code}/review`);
  }
  revalidatePath("/me");
}

export async function moderateComment(formData: FormData) {
  await requireAdmin("/admin/reviews");
  const ids = formData.getAll("reviewId").map(Number).filter(Number.isInteger);
  const decision = formData.get("decision") === "approve" ? "approved" : "rejected";
  const codes = await moderateComments(db, ids, decision);
  for (const code of codes) revalidatePath(`/modules/${code}`);
  revalidatePath("/admin/reviews");
}
