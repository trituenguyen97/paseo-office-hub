import type { PluginScreenProps } from "@getpaseo/plugin/client";
import type { ReactNode } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";

export type Tone = { from: string; to: string };

// The second stop of a section's gradient: the same color with the hue turned a little.
function shiftHue(hex: string, degrees: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let sat = 0;
  if (d !== 0) {
    sat = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + degrees + 360) % 360;
  }
  const c = (1 - Math.abs(2 * l - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const part = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${part(r1)}${part(g1)}${part(b1)}`;
}

export const toneFromColor = (hex: string): Tone => ({ from: hex, to: shiftHue(hex, 28) });

export const rgba = (hex: string, alpha: number) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

// Gradient, blur and inset shadow are web style keys. react-native-web passes them to the DOM,
// and native clients ignore them and keep the translucent backgroundColor.
const glassStyle = (tone: Tone, strength: number): ViewStyle =>
  ({
    backgroundColor: rgba(tone.from, 0.05 * strength),
    backgroundImage: `linear-gradient(135deg, ${rgba(tone.from, 0.13 * strength)}, ${rgba(tone.to, 0.04 * strength)})`,
    backdropFilter: "blur(18px) saturate(170%)",
    WebkitBackdropFilter: "blur(18px) saturate(170%)",
    boxShadow: "0 2px 10px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.1)",
  }) as ViewStyle;

export function GlassCard({
  tone,
  theme,
  icon,
  label,
  expanded,
  onToggle,
  trailing,
  children,
}: {
  tone: Tone;
  theme: PluginScreenProps["theme"];
  icon: string;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View
      style={{
        marginHorizontal: 8,
        marginVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        overflow: "hidden",
        ...glassStyle(tone, expanded ? 1 : 0.7),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", paddingRight: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={label}
          onPress={onToggle}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 9 }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              ...({
                backgroundColor: rgba(tone.from, 0.3),
                backgroundImage: `linear-gradient(135deg, ${rgba(tone.from, 0.55)}, ${rgba(tone.to, 0.55)})`,
              } as ViewStyle),
            }}
          >
            <Text style={{ fontSize: 13 }}>{icon}</Text>
          </View>
          <Text style={{ flex: 1, color: theme.colors.foreground, fontSize: 13, fontWeight: "600", letterSpacing: 0.2 }}>
            {label}
          </Text>
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>{expanded ? "▾" : "▸"}</Text>
        </Pressable>
        {trailing}
      </View>
      {expanded ? <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>{children}</View> : null}
    </View>
  );
}
