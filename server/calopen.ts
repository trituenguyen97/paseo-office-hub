import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { localAppData, mergeEnv, windowsEnv } from "./winenv";
import type { outlookOpen } from "../shared/cal";

const OFFICE_VERSIONS = ["Office16", "Office15", "Office14"];

// New Outlook for Windows has no deep link to a section (olk.exe ignores ms-outlook:// paths and
// command-line arguments), so the script starts it, finds the section button in the left rail
// through UI Automation and clicks it. Every step is written to PASEO_OPEN_LOG.
const newOutlookScript = (section: "Calendar" | "Mail") => `
$log = $env:PASEO_OPEN_LOG
function Log($m) { try { Add-Content -Path $log -Value ("{0} {1}" -f (Get-Date -Format s), $m) } catch {} }
Trap { Log ("error: " + $_.Exception.Message); exit 3 }
$ErrorActionPreference = 'Stop'
Log 'start ${section}'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Drawing
Add-Type -Namespace W -Name U -ReferencedAssemblies System.Drawing -MemberDefinition @'
public delegate bool EnumProc(System.IntPtr h, System.IntPtr l);
[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr h, int cmd);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr h);
[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, int extra);
[DllImport("user32.dll")] public static extern bool EnumChildWindows(System.IntPtr parent, EnumProc proc, System.IntPtr l);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(System.IntPtr h, System.Text.StringBuilder s, int max);
[DllImport("user32.dll")] public static extern bool ScreenToClient(System.IntPtr h, ref System.Drawing.Point p);
[DllImport("user32.dll")] public static extern bool PostMessage(System.IntPtr h, uint msg, System.IntPtr w, System.IntPtr l);
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern bool GetCursorPos(out System.Drawing.Point p);
[DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, int e);
'@
[void][W.U]::SetProcessDPIAware()

function Get-Olk { Get-Process olk -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 }
function Show-Olk($p) {
  [void][W.U]::ShowWindow($p.MainWindowHandle, 9)
  # A tap on Alt lets a background process take the foreground.
  [W.U]::keybd_event(0x12, 0, 0, 0)
  [W.U]::keybd_event(0x12, 0, 2, 0)
  [void][W.U]::SetForegroundWindow($p.MainWindowHandle)
}
function Find-Button($p) {
  $root = [Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle)
  $cond = New-Object Windows.Automation.AndCondition(
    (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty, '${section}')),
    (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty, [Windows.Automation.ControlType]::Button)))
  $root.FindFirst([Windows.Automation.TreeScope]::Descendants, $cond)
}
# The window title starts with the open section, for example "Calendar - Name - Outlook".
function On-Section { $p = Get-Olk; return ($p -and $p.MainWindowTitle -like '${section}*') }

# Reuse an open Outlook window instead of opening a second one.
if (-not (Get-Olk)) {
  Start-Process $env:PASEO_OLK
  Log 'started olk'
}

$deadline = (Get-Date).AddSeconds(40)
$button = $null
$proc = $null
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 700
  $proc = Get-Olk
  if (-not $proc) { continue }
  Show-Olk $proc
  Start-Sleep -Milliseconds 300
  if (On-Section) { Log 'already on ${section}'; exit 0 }
  $button = Find-Button $proc
  if ($button) { break }
}
if (-not $button) { Log '${section} button not found'; exit 1 }

# Attempt 1: post the click to the Chromium render widget. It needs neither the foreground nor the cursor.
$script:widget = [System.IntPtr]::Zero
$cb = [W.U+EnumProc]{
  param($h, $l)
  $sb = New-Object System.Text.StringBuilder 256
  [void][W.U]::GetClassName($h, $sb, 256)
  if ($sb.ToString() -eq 'Chrome_RenderWidgetHostHWND') { $script:widget = $h; return $false }
  return $true
}
[void][W.U]::EnumChildWindows($proc.MainWindowHandle, $cb, [System.IntPtr]::Zero)
$r = $button.Current.BoundingRectangle
$cx = [int]($r.X + $r.Width / 2)
$cy = [int]($r.Y + $r.Height / 2)
if ($script:widget -ne [System.IntPtr]::Zero) {
  $pt = New-Object System.Drawing.Point $cx, $cy
  [void][W.U]::ScreenToClient($script:widget, [ref]$pt)
  $lp = [System.IntPtr](($pt.Y -shl 16) -bor ($pt.X -band 0xFFFF))
  [void][W.U]::PostMessage($script:widget, 0x200, [System.IntPtr]::Zero, $lp)
  [void][W.U]::PostMessage($script:widget, 0x201, [System.IntPtr]1, $lp)
  [void][W.U]::PostMessage($script:widget, 0x202, [System.IntPtr]::Zero, $lp)
  Log 'posted click'
  Start-Sleep -Milliseconds 1500
  if (On-Section) { Log 'done ${section}'; exit 0 }
} else {
  Log 'render widget not found'
}

# Attempt 2: a real mouse click, only while Outlook is the foreground window so it cannot hit another app.
$proc = Get-Olk
Show-Olk $proc
Start-Sleep -Milliseconds 500
if ([W.U]::GetForegroundWindow() -ne $proc.MainWindowHandle) { Log 'cannot take foreground, giving up'; exit 2 }
$old = New-Object System.Drawing.Point
[void][W.U]::GetCursorPos([ref]$old)
[void][W.U]::SetCursorPos($cx, $cy)
[W.U]::mouse_event(2, 0, 0, 0, 0)
[W.U]::mouse_event(4, 0, 0, 0, 0)
Start-Sleep -Milliseconds 300
[void][W.U]::SetCursorPos($old.X, $old.Y)
Start-Sleep -Milliseconds 1200
if (On-Section) { Log 'done ${section} (mouse)'; exit 0 }
Log 'click did not change the section'
exit 4
`;

export function findClassicOutlook(): string | null {
  const roots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter((r): r is string => !!r);
  for (const root of roots) {
    for (const v of OFFICE_VERSIONS) {
      for (const sub of [join("Microsoft Office", "root", v), join("Microsoft Office", v)]) {
        const exe = join(root, sub, "OUTLOOK.EXE");
        if (existsSync(exe)) return exe;
      }
    }
  }
  return null;
}


// olk.exe is an app execution alias (a reparse point), which existsSync cannot stat, so list the folder.
function hasNewOutlook(): boolean {
  try {
    return readdirSync(join(localAppData(), "Microsoft", "WindowsApps")).includes("olk.exe");
  } catch {
    return false;
  }
}

export async function openOutlook(input: RpcInput<typeof outlookOpen>): Promise<RpcOutput<typeof outlookOpen>> {
  if (hasNewOutlook()) {
    const encoded = Buffer.from(newOutlookScript(input.section), "utf16le").toString("base64");
    const systemRoot = windowsEnv().SystemRoot;
    const child = spawn(
      join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
      ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", encoded],
      {
        // Not detached: Windows PowerShell started without a console silently runs nothing.
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: mergeEnv({
          ...process.env,
          ...windowsEnv(),
          PASEO_OPEN_LOG: join(homedir(), ".paseo", "wc-status-open.log"),
          PASEO_OLK: join(localAppData(), "Microsoft", "WindowsApps", "olk.exe"),
        }),
      },
    );
    let output = "";
    const collect = (chunk: Buffer) => {
      if (output.length < 600) output += chunk.toString();
    };
    child.stdout?.on("data", collect);
    child.stderr?.on("data", collect);
    child.on("error", (error) => console.error("open New Outlook failed", error));
    child.on("close", (code) => {
      console.log(`open ${input.section} script exit=${code}${output ? ` output=${output.slice(0, 400)}` : ""}`);
    });
    return { opened: "desktop" };
  }
  const exe = findClassicOutlook();
  if (!exe) return { opened: "none" };
  // "/select outlook:<folder>" opens that folder in a running or new classic Outlook window.
  const folder = input.section === "Calendar" ? "calendar" : "inbox";
  const child = spawn(exe, ["/select", `outlook:${folder}`], { detached: true, stdio: "ignore" });
  child.on("error", (error) => console.error("open Outlook failed", error));
  child.unref();
  return { opened: "desktop" };
}
