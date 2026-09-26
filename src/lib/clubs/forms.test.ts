import { describe, expect, it } from "vitest";

import { answersFromFormData, formatAnswer, formFieldsSchema, validateAnswers, type FormField } from "./forms";

const fields: FormField[] = [
  { id: "name01", type: "short_text", label: "Program", required: true },
  { id: "why001", type: "long_text", label: "Why?", required: false },
  { id: "team01", type: "single_choice", label: "Team", required: true, options: ["Tech", "Marketing"] },
  { id: "days01", type: "multi_choice", label: "Days", required: false, options: ["Mon", "Tue", "Wed"] },
  { id: "link01", type: "url", label: "LinkedIn", required: false },
  { id: "ok0001", type: "checkbox", label: "I agree", required: true },
];

describe("formFieldsSchema", () => {
  it("accepts a valid definition", () => {
    expect(formFieldsSchema.safeParse(fields).success).toBe(true);
  });
  it("rejects choice fields with fewer than two options and duplicate ids", () => {
    expect(formFieldsSchema.safeParse([{ ...fields[2], options: ["Only"] }]).success).toBe(false);
    expect(formFieldsSchema.safeParse([fields[0], fields[0]]).success).toBe(false);
  });
  it("rejects unknown types and empty labels", () => {
    expect(formFieldsSchema.safeParse([{ ...fields[0], type: "file" }]).success).toBe(false);
    expect(formFieldsSchema.safeParse([{ ...fields[0], label: "  " }]).success).toBe(false);
  });
});

describe("validateAnswers", () => {
  it("accepts complete answers and normalises them", () => {
    const res = validateAnswers(fields, {
      name01: "  Informatics, 3rd semester ",
      why001: "",
      team01: "Tech",
      days01: ["Mon", "Mon", "Wed"],
      link01: "https://linkedin.com/in/x",
      ok0001: true,
    });
    expect(res).toEqual({
      ok: true,
      answers: { name01: "Informatics, 3rd semester", why001: "", team01: "Tech", days01: ["Mon", "Wed"], link01: "https://linkedin.com/in/x", ok0001: true },
    });
  });

  it("reports missing, invalid and tampered values", () => {
    const res = validateAnswers(fields, { name01: "", team01: "Hacker", days01: ["Sun"], link01: "javascript:alert(1)", ok0001: false });
    expect(res.ok).toBe(false);
    if (!res.ok)
      expect(Object.keys(res.errors).sort()).toEqual(["days01", "link01", "name01", "ok0001", "team01"].sort());
  });

  it("limits text length", () => {
    const res = validateAnswers([fields[0]], { name01: "x".repeat(301) });
    expect(res.ok).toBe(false);
  });
});

describe("answersFromFormData", () => {
  it("reads multi-choice lists and checkboxes", () => {
    const fd = new FormData();
    fd.append("field_name01", "CS");
    fd.append("field_days01", "Mon");
    fd.append("field_days01", "Tue");
    fd.append("field_ok0001", "on");
    const raw = answersFromFormData(fields, fd);
    expect(raw).toMatchObject({ name01: "CS", days01: ["Mon", "Tue"], ok0001: true, why001: "" });
  });
});

describe("formatAnswer", () => {
  it("formats all answer shapes", () => {
    expect(formatAnswer(fields[3], ["Mon", "Tue"])).toBe("Mon, Tue");
    expect(formatAnswer(fields[5], true)).toBe("Yes");
    expect(formatAnswer(fields[1], "")).toBe("—");
  });
});
