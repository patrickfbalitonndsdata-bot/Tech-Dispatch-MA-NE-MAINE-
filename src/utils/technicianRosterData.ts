import { TechnicianAirtableEntry, TemplateBranding } from "../types";

/**
 * Official Technician Roster with their assigned personal Airtable View/Share links.
 * These links are automatically embedded into the technician's Outlook dispatch email
 * and plain text exports:
 * e.g., "${regionName} AirTable Link: <a href='...'>Alexander Shaw's Airtable</a>"
 */
export const DEFAULT_TECHNICIAN_ROSTER: TechnicianAirtableEntry[] = [
  {
    name: "Alexander Shaw",
    airtableUrl: "https://airtable.com/appPsh2I84PoFJN9x/shrUoxrRAlmIwdc8I",
    email: "alexander.shaw@ndsdata.com",
    region: "Northeast",
    active: true,
  },
  {
    name: "Miguel Hendry",
    airtableUrl: "https://airtable.com/appPsh2I84PoFJN9x/shrk0AceEpbOOdZjC",
    email: "miguel.hendry@ndsdata.com",
    region: "Northeast",
    active: true,
  },
  {
    name: "Madison Lopez",
    airtableUrl: "https://airtable.com/appPsh2I84PoFJN9x/shrY1ehEwWcySo4xT",
    email: "madison.lopez@ndsdata.com",
    region: "Northeast",
    active: true,
  },
  {
    name: "Joshua McDougal",
    airtableUrl: "https://airtable.com/appPsh2I84PoFJN9x/shr4gKW3HuR9ewje3",
    email: "joshua.mcdougal@ndsdata.com",
    region: "Northeast",
    active: true,
  },
  {
    name: "Damian Palmer",
    airtableUrl: "https://airtable.com/appPsh2I84PoFJN9x/shrBzr508LZssRVY8",
    email: "damian.palmer@ndsdata.com",
    region: "Northeast",
    active: true,
  },
  {
    name: "Anthony Ferrell",
    airtableUrl: "https://airtable.com/appPsh2I84PoFJN9x/shrDU4viNwtxetNSQ",
    email: "anthony.ferrell@ndsdata.com",
    region: "Northeast",
    active: true,
  },
  {
    name: "Giovonn Robinson",
    airtableUrl: "https://airtable.com/appPsh2I84PoFJN9x/shrs9mWcnMrvI6gWu",
    email: "giovonn.robinson@ndsdata.com",
    region: "Northeast",
    active: true,
  },
  {
    name: "James Londeree",
    airtableUrl: "https://airtable.com/appPsh2I84PoFJN9x/shrBmkVz15DWP4R9D",
    email: "james.londeree@ndsdata.com",
    region: "Northeast",
    active: true,
  },
  {
    name: "Aria Ghiorbani",
    airtableUrl: "https://airtable.com/appPsh2I84PoFJN9x/shrvrozujNRDd16aZ",
    email: "aria.ghiorbani@ndsdata.com",
    region: "Northeast",
    active: true,
  },
];

/**
 * Cleans and normalizes a technician name for reliable matching against roster entries.
 */
export function normalizeTechNameKey(rawName?: string): string {
  if (!rawName) return "";
  let s = String(rawName).trim().toLowerCase();
  // Remove quotation marks, backslashes
  s = s.replace(/["“”„‟'`\\]/g, "");
  // If in "Last, First" format, swap to "First Last"
  if (s.includes(",")) {
    const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      s = `${parts.slice(1).join(" ")} ${parts[0]}`.trim();
    }
  }
  // Collapse whitespace
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Finds a technician's specific Airtable entry by looking up both custom branding overrides
 * and the default roster.
 */
export function findTechnicianAirtableEntry(
  techName: string,
  branding?: TemplateBranding
): TechnicianAirtableEntry | undefined {
  const cleanKey = normalizeTechNameKey(techName);
  if (!cleanKey) return undefined;

  const listToSearch: TechnicianAirtableEntry[] =
    branding?.technicianAirtableLinks && branding.technicianAirtableLinks.length > 0
      ? branding.technicianAirtableLinks
      : DEFAULT_TECHNICIAN_ROSTER;

  // 1. Exact match on normalized key
  const exact = listToSearch.find((entry) => normalizeTechNameKey(entry.name) === cleanKey);
  if (exact) return exact;

  // 2. Word-boundary or token match (e.g. "Joshua McDougal" in "Joshua McDougal - Field Tech")
  const words = cleanKey.split(" ").filter((w) => w.length > 1);
  const tokenMatch = listToSearch.find((entry) => {
    const entryWords = normalizeTechNameKey(entry.name).split(" ").filter((w) => w.length > 1);
    if (entryWords.length >= 2 && words.length >= 2) {
      // Check if both first and last name match
      const firstMatches = words[0] === entryWords[0];
      const lastMatches = words[words.length - 1] === entryWords[entryWords.length - 1];
      return firstMatches && lastMatches;
    }
    return false;
  });

  return tokenMatch;
}

/**
 * Resolves the final Airtable URL for a technician:
 * - If a personal assigned Airtable link exists, returns that exact URL
 * - Otherwise, falls back to the configured airtableBaseUrl with ?tech= query,
 *   or the default Airtable app search URL.
 */
export function resolveTechnicianAirtableUrl(
  techName: string,
  branding?: TemplateBranding
): string {
  const entry = findTechnicianAirtableEntry(techName, branding);
  if (entry && entry.airtableUrl && entry.airtableUrl.trim()) {
    return entry.airtableUrl.trim();
  }

  const cleanName = normalizeTechNameKey(techName) || "Technician";
  if (branding?.airtableBaseUrl && branding.airtableBaseUrl.trim()) {
    const base = branding.airtableBaseUrl.trim();
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}tech=${encodeURIComponent(cleanName)}`;
  }

  return `https://airtable.com/appSearch?tech=${encodeURIComponent(cleanName)}`;
}

/**
 * Checks if a technician has a direct personal Airtable link assigned.
 */
export function hasDirectTechnicianAirtableLink(
  techName: string,
  branding?: TemplateBranding
): boolean {
  const entry = findTechnicianAirtableEntry(techName, branding);
  return Boolean(entry && entry.airtableUrl && entry.airtableUrl.trim());
}
