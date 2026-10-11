// Enquiry pipeline (light CRM) helpers. Pure: safe for server and client code.
import type { Tone } from "@/components/ui/Badge";

export type EnquiryStatusCode = "NEW" | "CONTACTED" | "SITE_VISIT" | "PROPOSAL_SENT" | "WON" | "LOST" | "IN_PROGRESS" | "CLOSED";

/** Active pipeline, in order. IN_PROGRESS and CLOSED are legacy values kept only for old records. */
export const PIPELINE = ["NEW", "CONTACTED", "SITE_VISIT", "PROPOSAL_SENT", "WON", "LOST"] as const;
export type PipelineStatus = (typeof PIPELINE)[number];
export const LEGACY_STATUSES = ["IN_PROGRESS", "CLOSED"] as const;
/** Statuses for which no follow-up is expected. */
export const TERMINAL_STATUSES = ["WON", "LOST", "CLOSED"] as const;

export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatusCode, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  SITE_VISIT: "Site visit",
  PROPOSAL_SENT: "Proposal sent",
  WON: "Won",
  LOST: "Lost",
  IN_PROGRESS: "In progress (old)",
  CLOSED: "Closed (old)",
};

export const ENQUIRY_STATUS_TONE: Record<EnquiryStatusCode, Tone> = {
  NEW: "yellow",
  CONTACTED: "blue",
  SITE_VISIT: "purple",
  PROPOSAL_SENT: "blue",
  WON: "green",
  LOST: "red",
  IN_PROGRESS: "gray",
  CLOSED: "gray",
};

export const isLegacyStatus = (s: string) => (LEGACY_STATUSES as readonly string[]).includes(s);
export const isTerminalStatus = (s: string) => (TERMINAL_STATUSES as readonly string[]).includes(s);

/** Status options for a select: the pipeline, plus the enquiry's current legacy value if it has one. */
export function statusOptions(current?: string | null) {
  const codes: EnquiryStatusCode[] = [...PIPELINE];
  if (current && isLegacyStatus(current)) codes.unshift(current as EnquiryStatusCode);
  return codes.map((value) => ({ value, label: ENQUIRY_STATUS_LABEL[value] }));
}

/**
 * Follow-up dates are calendar dates, stored as UTC midnight of that date.
 * "Today" is taken in the business time zone (India).
 */
export const BUSINESS_TZ = "Asia/Kolkata";

/** YYYY-MM-DD of `now` in the business time zone. */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** YYYY-MM-DD of a stored follow-up date (value for an <input type="date">). */
export const followUpKey = (d: Date | string | null | undefined): string => (d ? new Date(d).toISOString().slice(0, 10) : "");

/** Parse YYYY-MM-DD into the stored form (UTC midnight). Returns null for empty, undefined for invalid. */
export function parseFollowUp(v: string | null | undefined): Date | null | undefined {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || followUpKey(d) !== v ? undefined : d;
}

/** Exclusive upper bound for "due by end of today": UTC midnight of tomorrow's business date. */
export function endOfTodayBound(now: Date = new Date()): Date {
  const d = new Date(`${todayKey(now)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** True when the follow-up date is before today (business time zone). */
export function isFollowUpOverdue(date: Date | string | null | undefined, now: Date = new Date()): boolean {
  return !!date && followUpKey(date) < todayKey(now);
}

/** True when the follow-up is today or earlier. */
export const isFollowUpDue = (date: Date | string | null | undefined, now: Date = new Date()) => !!date && followUpKey(date) <= todayKey(now);

/** Display a follow-up date without time-zone drift. */
export function formatFollowUp(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
