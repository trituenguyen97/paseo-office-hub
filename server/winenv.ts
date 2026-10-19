import { homedir } from "node:os";
import { basename, join } from "node:path";

export const localAppData = () => process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");

// The plugin process can run with a trimmed environment. Windows PowerShell then fails to start with
// "Loading managed Windows PowerShell failed with error 8009001d", so fill in the variables it needs.
export function windowsEnv(): Record<string, string> {
  const e = process.env;
  const systemRoot = e.SystemRoot ?? e.windir ?? "C:\\Windows";
  const systemDrive = e.SystemDrive ?? systemRoot.slice(0, 2);
  const home = homedir();
  const local = localAppData();
  const programFiles = e.ProgramFiles ?? `${systemDrive}\\Program Files`;
  const system32 = join(systemRoot, "System32");
  return {
    SystemRoot: systemRoot,
    windir: systemRoot,
    SystemDrive: systemDrive,
    ComSpec: e.ComSpec ?? join(system32, "cmd.exe"),
    ProgramData: e.ProgramData ?? `${systemDrive}\\ProgramData`,
    ALLUSERSPROFILE: e.ALLUSERSPROFILE ?? e.ProgramData ?? `${systemDrive}\\ProgramData`,
    ProgramFiles: programFiles,
    "ProgramFiles(x86)": e["ProgramFiles(x86)"] ?? `${systemDrive}\\Program Files (x86)`,
    CommonProgramFiles: e.CommonProgramFiles ?? join(programFiles, "Common Files"),
    USERPROFILE: home,
    APPDATA: e.APPDATA ?? join(home, "AppData", "Roaming"),
    LOCALAPPDATA: local,
    TEMP: e.TEMP ?? join(local, "Temp"),
    TMP: e.TMP ?? e.TEMP ?? join(local, "Temp"),
    USERNAME: e.USERNAME ?? basename(home),
    COMPUTERNAME: e.COMPUTERNAME ?? "PASEO",
    PATHEXT: e.PATHEXT ?? ".COM;.EXE;.BAT;.CMD",
    Path: [e.Path ?? e.PATH ?? "", system32, systemRoot, join(system32, "WindowsPowerShell", "v1.0")]
      .filter(Boolean)
      .join(";"),
  };
}

// Windows environment names are case-insensitive, and a block holding both PATH and Path confuses
// child processes, so keep only the last spelling of each name.
export function mergeEnv(vars: Record<string, string | undefined>): Record<string, string> {
  const merged = new Map<string, [string, string]>();
  for (const [name, value] of Object.entries(vars)) {
    if (value !== undefined) merged.set(name.toLowerCase(), [name, value]);
  }
  return Object.fromEntries(merged.values());
}
