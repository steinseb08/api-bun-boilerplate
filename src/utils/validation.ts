import type { ZodError } from "zod";

export function zodErrorToFieldMap(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "body";
    if (!fields[key]) fields[key] = [];
    fields[key].push(issue.message);
  }

  return fields;
}
