const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Converts `"15m"`, `"4h"`, `"7d"` or `"900s"` to milliseconds (the format validated in the env config). */
export function durationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error(`Invalid duration "${duration}"`);
  return Number(match[1]) * UNIT_MS[match[2]];
}
