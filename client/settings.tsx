import { useSettings } from "@getpaseo/plugin/client";
import { useEffect } from "react";
import {
  DEFAULT_COLORS,
  DEFAULT_TITLES,
  type OfficeSettings,
  type SectionKey,
  officeSettings,
  withDefaults,
} from "../shared/settings";
import { type Tone, toneFromColor } from "./glass";

const RELOAD_MS = 20_000;

// Each component holds its own copy of the settings, so re-read them now and then to pick up a change
// made from another screen, for example the switches in Settings.
function useSettingsDocument() {
  const state = useSettings(officeSettings);
  const { reload } = state;
  useEffect(() => {
    const t = setInterval(() => void reload(), RELOAD_MS);
    return () => clearInterval(t);
  }, [reload]);
  return state;
}

// The saved settings with defaults filled in, or null while they load.
export function useOfficeSettings(): OfficeSettings | null {
  const state = useSettingsDocument();
  if (state.status === "loading") return null;
  if (state.status === "ready") return withDefaults(state.values);
  return withDefaults(null);
}

// The title and gradient of one sidebar section: the user's choice, else the default.
export function useSectionStyle(key: SectionKey): { title: string; tone: Tone } {
  const settings = useOfficeSettings();
  return {
    title: settings?.titles[key] ?? DEFAULT_TITLES[key],
    tone: toneFromColor(settings?.colors[key] ?? DEFAULT_COLORS[key]),
  };
}

// Whether meeting popups are on, with a function that flips and saves it. Used by the bell icon.
export function useMeetingAlertToggle() {
  const state = useSettingsDocument();
  const values = withDefaults(state.status === "ready" ? state.values : null);
  const revision = state.status === "ready" || state.status === "invalid" ? state.revision : null;
  return {
    ready: revision !== null,
    enabled: values.meetingAlert,
    toggle: () => {
      if (revision !== null) void state.save({ ...values, meetingAlert: !values.meetingAlert }, revision);
    },
  };
}
