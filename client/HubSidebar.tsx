import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { useEffect, useRef } from "react";
import { ScrollView, useWindowDimensions } from "react-native";
import { CalSidebar } from "./CalSidebar";
import { MailSidebar } from "./MailSidebar";
import { NotesSidebar } from "./NotesSidebar";
import { WcSidebar } from "./WcSidebar";
import { useOfficeSettings } from "./settings";
import { scrollOnWheel } from "./web";

// The plugin may use at most this share of the window height. Anything taller scrolls inside it, so
// the workspace list below always keeps the other half.
const MAX_HEIGHT_SHARE = 0.5;

// One sidebar item that holds every section the user turned on, in a single scrolling area.
export function HubSidebar(props: PluginSidebarItemProps) {
  const settings = useOfficeSettings();
  const { height } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const visible = settings !== null && Object.values(settings.show).some(Boolean);
  // The browser's own wheel scrolling skipped parts of the cards, so scroll by hand over the whole area.
  useEffect(() => (visible ? scrollOnWheel(ref.current?.getScrollableNode()) : undefined), [visible]);
  if (!settings) return null;
  const { show } = settings;
  if (!show.wc && !show.calendar && !show.mail && !show.notes) return null;

  return (
    <ScrollView
      ref={ref}
      nestedScrollEnabled
      style={{ maxHeight: Math.round(height * MAX_HEIGHT_SHARE) }}
      showsVerticalScrollIndicator={false}
    >
      {show.wc ? <WcSidebar {...props} /> : null}
      {show.calendar ? <CalSidebar {...props} /> : null}
      {show.mail ? <MailSidebar {...props} /> : null}
      {show.notes ? <NotesSidebar {...props} /> : null}
    </ScrollView>
  );
}
