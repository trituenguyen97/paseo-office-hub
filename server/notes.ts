import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { DEADLINE_RE, type notesList, type notesUpdate } from "../shared/notes";
import { askAgent, findJson, stripBom } from "./agent";
import { addedLines } from "./diff";

const SESSION = join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Notepad++", "session.xml");
const META_FILE = join(homedir(), ".paseo", "wc-status-notes.json");
// Written by the scheduled sync agent: suggested title and deadline per note.
const AI_FILE = join(homedir(), ".paseo", "wc-status-notes-ai.json");
// Paseo keeps its own copy of every note: the editable detail plus the Notepad++ text it last saw.
const STORE_FILE = join(homedir(), ".paseo", "wc-status-notes-store.json");
const MAX_DETAIL = 100_000;

type Meta = Record<string, { title?: string; deadline?: string; done?: boolean; hidden?: boolean }>;
type Store = Record<string, { detail: string; baseline: string; syncedAt: string }>;
type Ai = Record<string, { hash?: string; title?: string; deadline?: string | null }>;

const decodeXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

async function readMeta(): Promise<Meta> {
  try {
    return JSON.parse(stripBom(await readFile(META_FILE, "utf8"))) as Meta;
  } catch {
    return {};
  }
}

async function readStore(): Promise<Store> {
  try {
    return JSON.parse(stripBom(await readFile(STORE_FILE, "utf8"))) as Store;
  } catch {
    return {};
  }
}

const stamp = (d: Date) => {
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

async function readAi(): Promise<Ai> {
  try {
    return JSON.parse(stripBom(await readFile(AI_FILE, "utf8"))) as Ai;
  } catch {
    return {};
  }
}

async function readText(path: string): Promise<{ text: string; modifiedAt: Date } | null> {
  try {
    const [buf, st] = await Promise.all([readFile(path), stat(path)]);
    return { text: stripBom(buf.toString("utf8")), modifiedAt: st.mtime };
  } catch {
    return null;
  }
}

const autoTitle = (text: string, name: string) => {
  const line = text.split(/\r?\n/).find((l) => l.trim() !== "");
  const t = line?.trim() ?? "";
  return t ? (t.length > 80 ? `${t.slice(0, 80)}…` : t) : name;
};

type PendingNote = {
  id: string;
  name: string;
  hash: string;
  needTitle: boolean;
  needDeadline: boolean;
  content: string;
};

export async function list(
  _input: RpcInput<typeof notesList>,
  { paseo }: PluginHandlerContext,
): Promise<RpcOutput<typeof notesList>> {
  let xml: string;
  try {
    xml = await readFile(SESSION, "utf8");
  } catch {
    return { available: false, notes: [] };
  }
  const [meta, ai, store] = await Promise.all([readMeta(), readAi(), readStore()]);
  let storeChanged = false;
  const notes: RpcOutput<typeof notesList>["notes"] = [];
  const seen = new Set<string>();
  const pending: PendingNote[] = [];
  for (const m of xml.matchAll(/<File\b([^>]*?)\/>/g)) {
    const attrs = Object.fromEntries(
      [...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], decodeXml(a[2])]),
    );
    const name: string = attrs.filename ? basename(attrs.filename) : "";
    // The backup file holds unsaved edits; saved tabs fall back to the file itself.
    const source = attrs.backupFilePath || attrs.filename;
    if (!source || !name) continue;
    const id = attrs.backupFilePath ? basename(attrs.backupFilePath) : attrs.filename;
    if (seen.has(id)) continue;
    seen.add(id);
    const file = await readText(source);
    if (!file || file.text.trim() === "") continue;
    const m2 = meta[id] ?? {};
    const a = ai[id] ?? {};
    const aiDeadline = a.deadline && DEADLINE_RE.test(a.deadline) ? a.deadline : null;

    // First sight copies the note into Paseo. Later Notepad++ changes are appended below the detail,
    // except for finished notes, which Notepad++ no longer touches.
    let entry = store[id];
    if (!entry) {
      entry = store[id] = { detail: file.text, baseline: file.text, syncedAt: new Date().toISOString() };
      storeChanged = true;
    } else if (!m2.done && file.text !== entry.baseline) {
      const added = addedLines(entry.baseline, file.text);
      if (added) {
        entry.detail = `${entry.detail.trimEnd()}\n\n── Cập nhật từ Notepad++ (${stamp(new Date())}) ──\n${added}`;
      }
      entry.baseline = file.text;
      entry.syncedAt = new Date().toISOString();
      storeChanged = true;
    }
    const detail = entry.detail;

    // New or edited content that still lacks a custom title or deadline goes to the AI sync.
    const hash = createHash("sha1").update(detail).digest("hex");
    const needTitle = !m2.title;
    const needDeadline = m2.deadline === undefined;
    if (!m2.hidden && !m2.done && a.hash !== hash && (needTitle || needDeadline)) {
      pending.push({ id, name, hash, needTitle, needDeadline, content: detail.slice(0, 4000) });
    }
    notes.push({
      id,
      name,
      title: m2.title || a.title?.trim() || autoTitle(detail, name),
      customTitle: !!m2.title,
      detail: detail.length > MAX_DETAIL ? `${detail.slice(0, MAX_DETAIL)}…` : detail,
      // An empty string means the user cleared the deadline, which beats the suggestion.
      deadline: m2.deadline !== undefined ? m2.deadline || null : aiDeadline,
      done: !!m2.done,
      hidden: !!m2.hidden,
      modifiedAt: file.modifiedAt.toISOString(),
    });
  }
  if (storeChanged) await writeStoreFile(store);
  maybeSync(paseo, pending);
  notes.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline || b.deadline) return a.deadline ? -1 : 1;
    return b.modifiedAt.localeCompare(a.modifiedAt);
  });
  return { available: true, notes };
}

async function writeStoreFile(store: Store) {
  await mkdir(dirname(STORE_FILE), { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2));
}

let writing: Promise<unknown> = Promise.resolve();

export function update(input: RpcInput<typeof notesUpdate>): Promise<RpcOutput<typeof notesUpdate>> {
  const run = writing.then(async () => {
    if (input.deadline && !DEADLINE_RE.test(input.deadline)) {
      throw new Error("Hạn phải có dạng YYYY-MM-DD hoặc YYYY-MM-DD HH:mm");
    }
    if (input.detail !== undefined) {
      const store = await readStore();
      const entry = store[input.id];
      if (entry) {
        entry.detail = input.detail;
        await writeStoreFile(store);
      }
    }
    const meta = await readMeta();
    const cur = { ...(meta[input.id] ?? {}) };
    if (input.title !== undefined) cur.title = input.title.trim() || undefined;
    if (input.deadline !== undefined) cur.deadline = input.deadline;
    if (input.done !== undefined) cur.done = input.done || undefined;
    if (input.hidden !== undefined) cur.hidden = input.hidden || undefined;
    if (cur.title || cur.deadline !== undefined || cur.done || cur.hidden) meta[input.id] = cur;
    else delete meta[input.id];
    await mkdir(dirname(META_FILE), { recursive: true });
    await writeFile(META_FILE, JSON.stringify(meta, null, 2));
    return {};
  });
  writing = run.catch(() => undefined);
  return run;
}

const SYNC_BATCH = 15;
const SYNC_COOLDOWN_MS = 60_000;
const SYNC_RETRY_MS = 5 * 60_000;

let syncing = false;
let nextSyncAt = 0;

// Runs when the panel polls and Notepad++ has new content: one short-lived background
// agent suggests titles and deadlines, and its answer is merged into the AI file.
function maybeSync(paseo: PluginHandlerContext["paseo"], pending: PendingNote[]) {
  if (pending.length === 0 || syncing || Date.now() < nextSyncAt) return;
  syncing = true;
  nextSyncAt = Date.now() + SYNC_COOLDOWN_MS;
  runSync(paseo, pending.slice(0, SYNC_BATCH))
    .catch((error) => {
      console.error("notes sync failed", error);
      nextSyncAt = Date.now() + SYNC_RETRY_MS;
    })
    .finally(() => {
      syncing = false;
    });
}

async function runSync(paseo: PluginHandlerContext["paseo"], batch: PendingNote[]) {
  const today = new Date();
  const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")} (${
    ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"][today.getDay()]
  })`;
  const prompt = [
    "Bạn đặt tiêu đề và hạn chót gợi ý cho các ghi chú Notepad++. Không dùng công cụ nào, chỉ trả lời.",
    `Hôm nay là ${todayText}, múi giờ Asia/Ho_Chi_Minh.`,
    "Với mỗi ghi chú:",
    "- title: chỉ khi needTitle là true. Tiêu đề ngắn gọn (tối đa 60 ký tự), cùng ngôn ngữ với nội dung, mô tả việc hoặc chủ đề. Không chép timestamp hay URL. Nếu needTitle là false thì để chuỗi rỗng.",
    '- deadline: chỉ khi needDeadline là true và nội dung nói rõ hạn của việc. Định dạng "YYYY-MM-DD" hoặc "YYYY-MM-DD HH:mm" (24 giờ). Quy ngày tương đối ("ngày mai", "thứ 6", "17/10") về ngày cụ thể dựa vào hôm nay. Không rõ hạn thì null. Không đoán.',
    "Chỉ trả về một mảng JSON, không thêm chữ nào khác, mỗi phần tử có dạng {\"id\": string, \"title\": string, \"deadline\": string | null}. Giữ nguyên id.",
    "",
    JSON.stringify(batch.map(({ id, name, needTitle, needDeadline, content }) => ({ id, name, needTitle, needDeadline, content }))),
  ].join("\n");

  const final = await askAgent(paseo, { prompt, title: "Notepad++ notes sync", timeoutMs: 120_000 });

  const parsed = findJson(final, "[");
  if (!Array.isArray(parsed)) {
    throw new Error(`sync agent returned no JSON array: ${final.slice(0, 200) || "(empty)"}`);
  }
  const answers = parsed as { id?: unknown; title?: unknown; deadline?: unknown }[];

  const ai = await readAi();
  for (const note of batch) {
    const ans = answers.find((a) => a.id === note.id);
    const title = typeof ans?.title === "string" ? ans.title.trim().slice(0, 80) : "";
    const deadline = typeof ans?.deadline === "string" && DEADLINE_RE.test(ans.deadline) ? ans.deadline : null;
    // Items the agent skipped still get this hash so they are not retried forever.
    ai[note.id] = {
      hash: note.hash,
      title: note.needTitle && title ? title : ai[note.id]?.title,
      deadline: note.needDeadline ? deadline : ai[note.id]?.deadline,
    };
  }
  await mkdir(dirname(AI_FILE), { recursive: true });
  await writeFile(AI_FILE, JSON.stringify(ai, null, 2));
}
