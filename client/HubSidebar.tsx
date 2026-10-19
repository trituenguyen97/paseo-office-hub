import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { ScrollView, useWindowDimensions } from "react-native";
import { CalSidebar } from "./CalSidebar";
import { MailSidebar } from "./MailSidebar";
import { NotesSidebar } from "./NotesSidebar";
import { WcSidebar } from "./WcSidebar";
import { useOfficeSettings } from "./settings";

// The plugin may use at most this share of the window height. Anything taller scrolls inside it, so
// the workspace list below always keeps the other half.
const MAX_HEIGHT_SHARE = 0.5;

// The desktop app treats empty sidebar space as part of the window's drag handle, and the mouse wheel never
// reaches such space. Excluding the area from dragging lets the wheel through, so the browser scrolls it
// itself, smoothly. It is a web style key, and other builds ignore it.
const NO_DRAG = { WebkitAppRegion: "no-drag" } as object;

// One sidebar item that holds every section the user turned on, in a single scrolling area.
export function HubSidebar(props: PluginSidebarItemProps) {
  const settings = useOfficeSettings();
  const { height } = useWindowDimensions();
  if (!settings) return null;
  const { show } = settings;
  if (!show.wc && !show.calendar && !show.mail && !show.notes) return null;

  return (
    <ScrollView
      nestedScrollEnabled
      style={{ maxHeight: Math.round(height * MAX_HEIGHT_SHARE), ...NO_DRAG }}
      showsVerticalScrollIndicator={false}
    >
      {show.wc ? <WcSidebar {...props} /> : null}
      {show.calendar ? <CalSidebar {...props} /> : null}
      {show.mail ? <MailSidebar {...props} /> : null}
      {show.notes ? <NotesSidebar {...props} /> : null}
    </ScrollView>
  );
}
