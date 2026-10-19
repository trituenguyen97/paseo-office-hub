import { spawn } from "node:child_process";
import { join } from "node:path";
import { z } from "zod";
import { calEvent, mailItem } from "../shared/cal";
import { stripBom } from "./agent";
import { mergeEnv, windowsEnv } from "./winenv";

const TIMEOUT_MS = 40_000;
const MAX_EVENTS = 100;
const MAX_MAIL = 25;

// Reads today's calendar and unread inbox mail of the default Outlook profile through COM.
// The classic Outlook (OUTLOOK.EXE) keeps a local cache of the mailbox, so this takes a fraction of a
// second and needs no extra sign-in or admin consent. The script has no backslashes or backticks
// on purpose, because it lives in a template literal.
const SCRIPT = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function Out-Json($o) { [Console]::Out.WriteLine(($o | ConvertTo-Json -Depth 5 -Compress)) }
try {
  # Without a profile, starting Outlook opens its first-run wizard, so check the registry first.
  $bs = [string][char]92
  $hasProfile = $false
  foreach ($version in '16.0', '15.0') {
    $path = ('Software', 'Microsoft', 'Office', $version, 'Outlook', 'Profiles') -join $bs
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($path)
    if ($key -ne $null -and $key.SubKeyCount -gt 0) { $hasProfile = $true }
  }
  if (-not $hasProfile) { throw 'Outlook cổ điển chưa có tài khoản nào (chưa tạo profile)' }
  $ol = New-Object -ComObject Outlook.Application
  $ns = $ol.GetNamespace('MAPI')
  $today = (Get-Date).Date
  $tomorrow = $today.AddDays(1)
  $culture = [System.Globalization.CultureInfo]::CurrentCulture
  $from = $today.ToString('g', $culture)
  $to = $tomorrow.ToString('g', $culture)
  $cr = [string][char]13
  $lf = [string][char]10

  $events = New-Object System.Collections.ArrayList
  $mail = New-Object System.Collections.ArrayList
  # Every mailbox in the profile is read. Stores without an address, such as archives, are skipped.
  foreach ($store in $ns.Stores) {
    $account = [string]$store.DisplayName
    if ($account -notlike '*@*') { continue }
    try {
      $items = $store.GetDefaultFolder(9).Items
      $items.IncludeRecurrences = $true
      $items.Sort('[Start]')
      $hits = $items.Restrict("[Start] < '" + $to + "' AND [End] > '" + $from + "'")
      $e = $hits.GetFirst()
      while ($e -ne $null -and $events.Count -lt ${MAX_EVENTS}) {
        # 5 and 7 are the canceled meeting states. Their notices stay in the calendar.
        if ($e.MeetingStatus -ne 5 -and $e.MeetingStatus -ne 7) {
          $join = $null
          try {
            $m = [regex]::Match([string]$e.Body, 'https://teams[.]microsoft[.]com/[^ <>"]+')
            if ($m.Success) { $join = $m.Value.Split([char]13)[0].Split([char]10)[0] }
          } catch {}
          [void]$events.Add([pscustomobject]@{
            id = [string]$e.EntryID
            account = $account
            subject = [string]$e.Subject
            start = $e.Start.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
            end = $e.End.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
            allDay = [bool]$e.AllDayEvent
            location = [string]$e.Location
            joinUrl = $join
          })
        }
        $e = $hits.GetNext()
      }
    } catch {}

    try {
      $msgs = $store.GetDefaultFolder(6).Items.Restrict("[Unread] = true AND [ReceivedTime] >= '" + $from + "'")
      $msgs.Sort('[ReceivedTime]', $true)
      $x = $msgs.GetFirst()
      $count = 0
      while ($x -ne $null -and $count -lt ${MAX_MAIL}) {
        $count++
        $preview = ''
        try {
          $body = [string]$x.Body
          if ($body.Length -gt 300) { $body = $body.Substring(0, 300) }
          $body = $body.Replace($cr, ' ').Replace($lf, ' ')
          $preview = [regex]::Replace($body, '[ ]+', ' ').Trim()
          if ($preview.Length -gt 120) { $preview = $preview.Substring(0, 120) }
        } catch {}
        $sender = ''
        try { $sender = [string]$x.SenderName } catch {}
        [void]$mail.Add([pscustomobject]@{
          id = [string]$x.EntryID
          account = $account
          subject = [string]$x.Subject
          sender = $sender
          receivedAt = $x.ReceivedTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
          preview = $preview
          hasAttachments = ($x.Attachments.Count -gt 0)
          webLink = $null
        })
        $x = $msgs.GetNext()
      }
    } catch {}
  }

  Out-Json ([pscustomobject]@{ events = @($events); mail = @($mail) })
} catch {
  Out-Json ([pscustomobject]@{ error = $_.Exception.Message })
}
`;

const resultSchema = z.union([
  z.object({ error: z.string() }),
  z.object({ events: z.array(z.unknown()), mail: z.array(z.unknown()) }),
]);

export type OutlookData = {
  events: z.infer<typeof calEvent>[];
  mail: z.infer<typeof mailItem>[];
};

export async function readOutlookViaCom(): Promise<OutlookData> {
  const encoded = Buffer.from(SCRIPT, "utf16le").toString("base64");
  const systemRoot = windowsEnv().SystemRoot;
  const stdout = await new Promise<string>((resolve, reject) => {
    // Not detached: Windows PowerShell started without a console silently runs nothing.
    const child = spawn(
      join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env: mergeEnv({ ...process.env, ...windowsEnv() }) },
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Outlook không phản hồi (quá 40 giây)"));
    }, TIMEOUT_MS);
    child.stdout.on("data", (c: Buffer) => {
      out += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      if (err.length < 400) err += c.toString("utf8");
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (out.trim()) resolve(out);
      else reject(new Error(`PowerShell thoát với mã ${code} và không có kết quả${err ? `: ${err.slice(0, 200)}` : ""}`));
    });
  });

  const line = stripBom(stdout).trim().split("\n").pop() ?? "";
  const parsed = resultSchema.safeParse(JSON.parse(line));
  if (!parsed.success) throw new Error(`Kết quả Outlook không hợp lệ: ${line.slice(0, 160)}`);
  if ("error" in parsed.data) throw new Error(parsed.data.error);

  return {
    events: parsed.data.events.flatMap((e) => {
      const p = calEvent.safeParse(e);
      return p.success ? [p.data] : [];
    }),
    mail: parsed.data.mail.flatMap((m) => {
      const p = mailItem.safeParse(m);
      return p.success ? [p.data] : [];
    }),
  };
}
