import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { Linking, Pressable, Text } from "react-native";
import { outlookOpen } from "../shared/cal";
import { type Tone, rgba } from "./glass";

const WEB_URL = { Calendar: "https://outlook.office.com/calendar", Mail: "https://outlook.office.com/mail" } as const;

// Opens a section of the desktop Outlook, or Outlook on the web when it is not installed.
export function OutlookOpenButton({
  section,
  label,
  tone,
  theme,
  onError,
}: {
  section: "Calendar" | "Mail";
  label: string;
  tone: Tone;
  theme: PluginScreenProps["theme"];
  onError: (message: string) => void;
}) {
  const open = useRpc(outlookOpen);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        void open({ section })
          .then((r) => (r.opened === "none" ? Linking.openURL(WEB_URL[section]) : undefined))
          .catch((e) => onError(e instanceof Error ? e.message : "Lỗi"));
      }}
      style={{
        alignSelf: "flex-start",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: rgba(tone.from, 0.22),
        borderWidth: 1,
        borderColor: rgba(tone.from, 0.45),
      }}
    >
      <Text style={{ color: theme.colors.foreground, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
