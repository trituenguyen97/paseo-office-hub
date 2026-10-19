import type { PluginClientContext } from "@getpaseo/plugin/client";
import { HubSidebar } from "./client/HubSidebar";
import { NotesPanel } from "./client/NotesPanel";
import { SettingsScreen } from "./client/SettingsScreen";

export default function contribute(client: PluginClientContext) {
  client.addSidebarHeaderItem({ id: "hub", title: "Office Hub", Component: HubSidebar });
  client.addSettingsScreen({ id: "settings", title: "Văn phòng", icon: "LayoutDashboard", Component: SettingsScreen });
  client.addScreen({ id: "notes", title: "Ghi nhớ Notepad++", Component: NotesPanel });
  client.addWorkspacePanel({
    id: "notes",
    title: "Ghi nhớ",
    icon: "StickyNote",
    context: "workspace",
    Component: NotesPanel,
  });
  client.addCommandCenterItem({
    id: "open-notes",
    title: "Mở ghi nhớ Notepad++",
    icon: "StickyNote",
    context: "workspace",
    onSelect({ openPanel }) {
      openPanel("notes");
    },
  });
  return () => {};
}
