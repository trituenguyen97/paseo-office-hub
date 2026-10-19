import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

// Every field is optional so a missing or older document still loads. Read values through
// `withDefaults`, which fills in the gaps.
export const officeSettings = defineSettings({
  id: "office",
  scope: "host",
  version: 1,
  schema: z.object({
    show: z
      .object({
        wc: z.boolean().optional(),
        calendar: z.boolean().optional(),
        mail: z.boolean().optional(),
        notes: z.boolean().optional(),
      })
      .optional(),
    // Which toilets WC-STATUS lists.
    wcFilter: z.enum(["men", "women", "all"]).optional(),
    // Custom section titles and accent colors (#rrggbb). A missing or empty value means the default.
    titles: z.record(z.string(), z.string()).optional(),
    colors: z.record(z.string(), z.string()).optional(),
    // Pop up a dialog when a meeting starts.
    meetingAlert: z.boolean().optional(),
    // Where calendar and mail come from. "auto" tries the Outlook on this machine, then the connector.
    outlookSource: z.enum(["auto", "com", "connector"]).optional(),
  }),
});

export type SectionKey = "wc" | "calendar" | "mail" | "notes";

export type OfficeSettings = {
  show: Record<SectionKey, boolean>;
  titles: Record<SectionKey, string>;
  colors: Record<SectionKey, string>;
  wcFilter: "men" | "women" | "all";
  meetingAlert: boolean;
  outlookSource: "auto" | "com" | "connector";
};

export const SECTION_KEYS: SectionKey[] = ["wc", "calendar", "mail", "notes"];

export const DEFAULT_TITLES: Record<SectionKey, string> = {
  wc: "WC-STATUS",
  calendar: "Lịch họp hôm nay",
  mail: "Mail chưa đọc hôm nay",
  notes: "Ghi nhớ (Notepad++)",
};

export const DEFAULT_COLORS: Record<SectionKey, string> = {
  wc: "#3fb68b",
  calendar: "#5b8def",
  mail: "#d96b7b",
  notes: "#d9a441",
};

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// The toilet status is off until the user turns it on in the settings.
export const DEFAULT_SETTINGS: OfficeSettings = {
  show: { wc: false, calendar: true, mail: true, notes: true },
  titles: DEFAULT_TITLES,
  colors: DEFAULT_COLORS,
  wcFilter: "men",
  meetingAlert: true,
  outlookSource: "auto",
};

type Stored = {
  show?: Partial<Record<SectionKey, boolean>>;
  titles?: Record<string, string>;
  colors?: Record<string, string>;
  wcFilter?: OfficeSettings["wcFilter"];
  meetingAlert?: boolean;
  outlookSource?: OfficeSettings["outlookSource"];
};

// Keeps only the entries that are usable, so an empty title or a malformed color falls back to the default.
function pick(
  defaults: Record<SectionKey, string>,
  stored: Record<string, string> | undefined,
  valid: (value: string) => boolean,
): Record<SectionKey, string> {
  const out = { ...defaults };
  for (const key of SECTION_KEYS) {
    const value = stored?.[key]?.trim();
    if (value && valid(value)) out[key] = value;
  }
  return out;
}

export const withDefaults = (stored: Stored | null | undefined): OfficeSettings => ({
  show: { ...DEFAULT_SETTINGS.show, ...(stored?.show ?? {}) } as Record<SectionKey, boolean>,
  titles: pick(DEFAULT_TITLES, stored?.titles, () => true),
  colors: pick(DEFAULT_COLORS, stored?.colors, (v) => HEX_COLOR_RE.test(v)),
  wcFilter: stored?.wcFilter ?? DEFAULT_SETTINGS.wcFilter,
  meetingAlert: stored?.meetingAlert ?? DEFAULT_SETTINGS.meetingAlert,
  outlookSource: stored?.outlookSource ?? DEFAULT_SETTINGS.outlookSource,
});
