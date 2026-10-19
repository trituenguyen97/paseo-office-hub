import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useRpc, useSettings } from "@getpaseo/plugin/client";
import {
  ExternalLink,
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { useEffect, useRef, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { outlookCheck, outlookConnect } from "../shared/outlookcheck";
import {
  DEFAULT_COLORS,
  DEFAULT_TITLES,
  HEX_COLOR_RE,
  type SectionKey,
  officeSettings,
  withDefaults,
} from "../shared/settings";

type Method = "com" | "connector";
type Result = {
  ok: boolean;
  summary: string;
  lines: string[];
  needs: "none" | "install" | "profile" | "connector" | "error";
};
type Stored = NonNullable<ReturnType<typeof officeSettings.schema.parse>>;

const SECTIONS: { key: SectionKey; hint: string }[] = [
  { key: "wc", hint: "Trạng thái nhà vệ sinh của văn phòng. Tắt mặc định, bật nếu văn phòng của bạn có dịch vụ này." },
  { key: "calendar", hint: "Cuộc họp hôm nay từ Outlook" },
  { key: "mail", hint: "Mail chưa đọc nhận trong ngày từ Outlook" },
  { key: "notes", hint: "Các tab Notepad++ thành ghi nhớ có hạn và trạng thái" },
];

const METHOD_LABEL: Record<Method, string> = {
  com: "Outlook trên máy (COM)",
  connector: "Connector Microsoft 365",
};

const CUSTOM = "custom";
const PRESETS = [
  { label: "Mặc định", value: "default" },
  { label: "Xanh ngọc", value: "#3fb68b" },
  { label: "Xanh dương", value: "#5b8def" },
  { label: "Tím", value: "#8b7bd8" },
  { label: "Hồng", value: "#d96b7b" },
  { label: "Cam", value: "#e08a45" },
  { label: "Vàng", value: "#d9a441" },
  { label: "Đỏ", value: "#e5604d" },
  { label: "Xám", value: "#8a8f98" },
  { label: "Tùy chỉnh (mã hex)", value: CUSTOM },
];

const DEBOUNCE_MS = 600;

export function SettingsScreen({ theme }: PluginSurfaceProps) {
  const state = useSettings(officeSettings);
  const check = useRpc(outlookCheck);
  const connect = useRpc(outlookConnect);
  const [checking, setChecking] = useState<Method | null>(null);
  const [results, setResults] = useState<Partial<Record<Method, Result>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  // Typing in a field must not save on every key, so edits wait for a short pause.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latest = useRef<{ stored: Stored; revision: string } | null>(null);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of Object.values(pending)) clearTimeout(t);
    };
  }, []);

  if (state.status === "loading") {
    return <Text style={{ color: theme.colors.foregroundMuted, padding: 16 }}>Đang tải cài đặt…</Text>;
  }
  const revision = state.status === "ready" || state.status === "invalid" ? state.revision : "";
  // Save from the stored document, not the defaults-filled copy, so only real choices are written.
  const stored: Stored = state.status === "ready" ? state.values : {};
  const values = withDefaults(stored);
  latest.current = { stored, revision };

  const save = (next: Stored) => void state.save(next, revision);
  const saveLater = (id: string, update: (current: Stored) => Stored) => {
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      const current = latest.current;
      if (current) void state.save(update(current.stored), current.revision);
    }, DEBOUNCE_MS);
  };

  const setMap = (field: "titles" | "colors", key: SectionKey, value: string): ((s: Stored) => Stored) => {
    return (s) => {
      const map = { ...(s[field] ?? {}) };
      if (value.trim()) map[key] = value.trim();
      else delete map[key];
      return { ...s, [field]: map };
    };
  };

  const runCheck = async (method: Method) => {
    setChecking(method);
    setNotice(null);
    try {
      const r = await check({ method });
      setResults((prev) => ({ ...prev, [method]: r }));
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [method]: { ok: false, summary: e instanceof Error ? e.message : "Lỗi", lines: [], needs: "error" },
      }));
    } finally {
      setChecking(null);
    }
  };

  const runConnect = async (method: Method) => {
    try {
      const r = await connect({ method });
      setNotice(r.message);
      if (r.action === "open-url" && r.url) void Linking.openURL(r.url);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 } as const;

  const renderResult = (method: Method) => {
    const r = results[method];
    if (!r) return null;
    const fix =
      r.needs === "profile" || r.needs === "connector" ? (
        <SettingsAction
          label={r.needs === "profile" ? "Chưa có tài khoản trong Outlook" : "Chưa kết nối connector"}
          hint={
            r.needs === "profile"
              ? "Mở Outlook cổ điển để thêm tài khoản công ty."
              : "Mở trang kết nối của Claude để bật connector Microsoft 365."
          }
          actionLabel={r.needs === "profile" ? "Mở Outlook để đăng nhập" : "Mở trang kết nối"}
          onPress={() => void runConnect(method)}
        />
      ) : null;
    return (
      <>
        <SettingsRow label={r.ok ? "✔ Đạt" : "✖ Chưa đạt"} hint={r.summary}>
          <View style={{ gap: 2, paddingTop: 4 }}>
            {r.lines.map((line) => (
              <Text key={line} style={{ ...muted, color: r.ok ? theme.colors.foregroundMuted : "#e5604d" }}>
                {line}
              </Text>
            ))}
          </View>
        </SettingsRow>
        {fix}
      </>
    );
  };

  const presetOf = (key: SectionKey) => {
    const color = stored.colors?.[key]?.trim();
    if (!color || !HEX_COLOR_RE.test(color)) return "default";
    return PRESETS.some((p) => p.value.toLowerCase() === color.toLowerCase()) ? color.toLowerCase() : CUSTOM;
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <SettingsSection title="Hiển thị trên sidebar">
        <SettingsCard>
          {SECTIONS.map((s) => (
            <SettingsSwitch
              key={s.key}
              label={values.titles[s.key]}
              hint={s.hint}
              value={values.show[s.key]}
              onValueChange={(on) => save({ ...stored, show: { ...values.show, [s.key]: on } })}
            />
          ))}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Tên và màu">
        {SECTIONS.map((s) => {
          const preset = presetOf(s.key);
          const customColor = stored.colors?.[s.key] ?? "";
          return (
            <SettingsCard key={s.key}>
              <SettingsInput
                label={`Tên: ${DEFAULT_TITLES[s.key]}`}
                hint="Để trống để dùng tên mặc định."
                initialValue={stored.titles?.[s.key] ?? ""}
                placeholder={DEFAULT_TITLES[s.key]}
                onChangeText={(text) => saveLater(`title-${s.key}`, setMap("titles", s.key, text))}
              />
              <SettingsSelect
                label="Màu"
                value={preset}
                options={PRESETS}
                onValueChange={(choice) => {
                  if (choice === CUSTOM) return;
                  save(setMap("colors", s.key, choice === "default" ? "" : choice)(stored));
                }}
              />
              {preset === CUSTOM || (customColor && !HEX_COLOR_RE.test(customColor)) ? (
                <SettingsInput
                  key={`hex-${s.key}-${preset}`}
                  label="Mã màu hex"
                  hint={`Dạng #rrggbb, ví dụ ${DEFAULT_COLORS[s.key]}. Mã sai sẽ dùng màu mặc định.`}
                  initialValue={customColor}
                  placeholder={DEFAULT_COLORS[s.key]}
                  error={customColor && !HEX_COLOR_RE.test(customColor) ? "Mã màu chưa đúng dạng #rrggbb" : null}
                  onChangeText={(text) => saveLater(`hex-${s.key}`, setMap("colors", s.key, text))}
                />
              ) : null}
            </SettingsCard>
          );
        })}
        <SettingsCard>
          <SettingsAction
            label="Khôi phục tên và màu mặc định"
            actionLabel="Khôi phục"
            onPress={() => save({ ...stored, titles: {}, colors: {} })}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Thông báo">
        <SettingsCard>
          <SettingsSwitch
            label="Popup khi tới giờ họp"
            hint="Hiện hộp thoại giữa màn hình khi cuộc họp bắt đầu. Cần mục lịch họp đang bật. Có thể tắt nhanh bằng biểu tượng chuông trên thẻ lịch."
            value={values.meetingAlert}
            onValueChange={(meetingAlert) => save({ ...stored, meetingAlert })}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Nhà vệ sinh">
        <SettingsCard>
          <SettingsSelect
            label="Hiển thị nhà vệ sinh"
            hint="Chỉ có tác dụng khi mục này được bật ở phần trên."
            value={values.wcFilter}
            options={[
              { label: "Chỉ Men", value: "men" },
              { label: "Chỉ Women", value: "women" },
              { label: "Cả hai", value: "all" },
            ]}
            onValueChange={(wcFilter) => save({ ...stored, wcFilter })}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Lịch và mail (Outlook)">
        <SettingsCard>
          <SettingsSelect
            label="Nguồn dữ liệu"
            hint="Tự động thử Outlook trên máy trước, rồi mới dùng connector. Connector chậm hơn và tốn token."
            value={values.outlookSource}
            options={[
              { label: "Tự động", value: "auto" },
              { label: "Chỉ Outlook trên máy (COM)", value: "com" },
              { label: "Chỉ connector Microsoft 365", value: "connector" },
            ]}
            onValueChange={(outlookSource) => save({ ...stored, outlookSource })}
          />
        </SettingsCard>
        {(["com", "connector"] as const).map((method) => (
          <SettingsCard key={method}>
            <SettingsAction
              label={METHOD_LABEL[method]}
              hint={
                method === "com"
                  ? "Cần Outlook cổ điển (Office) đã thêm tài khoản. Nhanh, không tốn token."
                  : "Cần connector Microsoft 365 trong Claude. Mất khoảng 20 đến 40 giây để kiểm tra."
              }
              actionLabel={checking === method ? "Đang kiểm tra…" : "Kiểm tra"}
              disabled={checking !== null}
              onPress={() => void runCheck(method)}
            />
            {renderResult(method)}
          </SettingsCard>
        ))}
        {notice ? <Text style={{ ...muted, paddingHorizontal: 4 }}>{notice}</Text> : null}
        <ExternalLink href="https://claude.ai/settings/connectors">Mở trang connector của Claude</ExternalLink>
      </SettingsSection>
    </ScrollView>
  );
}
