import { Violation } from "../rules/types";

export function formatJSON(violations: Violation[]): string {
  return JSON.stringify(violations, null, 2);
}
