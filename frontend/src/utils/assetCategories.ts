// Per-org asset category → tag-prefix mapping, stored in localStorage.
// Admins can add custom categories (e.g. "Cisco Devices" → "CISCO") and asset
// tags auto-generate using the prefix: CISCO-0001, CISCO-0002, ...

export type CategoryPrefix = { category: string; prefix: string };

const DEFAULTS: CategoryPrefix[] = [
  { category: "Laptop", prefix: "LAP" },
  { category: "Desktop", prefix: "DSK" },
  { category: "Monitor", prefix: "MON" },
  { category: "Printer", prefix: "PRT" },
  { category: "Network", prefix: "NET" },
  { category: "Server", prefix: "SRV" },
  { category: "Phone", prefix: "PHN" },
  { category: "Other", prefix: "IT" },
];

const key = (orgId: string | null | undefined) => `sep-asset-categories:${orgId || "global"}`;

export function loadCategories(orgId: string | null | undefined): CategoryPrefix[] {
  try {
    const raw = localStorage.getItem(key(orgId));
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULTS;
    return parsed;
  } catch {
    return DEFAULTS;
  }
}

export function saveCategories(orgId: string | null | undefined, list: CategoryPrefix[]): void {
  localStorage.setItem(key(orgId), JSON.stringify(list));
}

export function prefixFor(orgId: string | null | undefined, category: string): string {
  const list = loadCategories(orgId);
  const hit = list.find((c) => c.category.toLowerCase() === category.toLowerCase());
  return (hit?.prefix || "IT").toUpperCase();
}

// Build a category-aware asset tag, e.g. "CISCO-4821". Falls back to IT when
// the category is missing from the mapping (covers legacy assets).
export function buildAssetTag(orgId: string | null | undefined, category: string): string {
  const prefix = prefixFor(orgId, category);
  const suffix = Date.now().toString().slice(-4);
  return `${prefix}-${suffix}`;
}
