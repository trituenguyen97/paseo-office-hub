// Lines of `current` that `baseline` does not have, comparing as a multiset so repeated lines count.
export function addedLines(baseline: string, current: string): string {
  const seen = new Map<string, number>();
  for (const line of baseline.split(/\r?\n/)) seen.set(line.trimEnd(), (seen.get(line.trimEnd()) ?? 0) + 1);
  const added: string[] = [];
  for (const line of current.split(/\r?\n/)) {
    const key = line.trimEnd();
    const left = seen.get(key) ?? 0;
    if (left > 0) seen.set(key, left - 1);
    else added.push(line);
  }
  return added.join("\n").trim();
}
