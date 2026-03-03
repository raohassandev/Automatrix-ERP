export function normalizeInventoryName(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizeInventorySearch(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeSku(input: string | null | undefined) {
  const v = String(input || "").trim().toUpperCase();
  return v.length > 0 ? v : null;
}

