/**
 * Date helpers. Everything is handled as a plain 'YYYY-MM-DD' string in UTC so
 * the Africa/Kampala business day never shifts under a server timezone.
 */

export type IsoDate = string; // YYYY-MM-DD

export function today(): IsoDate {
  return new Date().toISOString().slice(0, 10);
}

export function toIso(v: string | Date | null | undefined): IsoDate | null {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

export function monthOf(v: string | Date | null | undefined): string | null {
  const iso = toIso(v);
  return iso ? iso.slice(0, 7) : null;
}

export function currentMonth(): string {
  return today().slice(0, 7);
}

export function parse(iso: IsoDate): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday: Monday = 1 ... Sunday = 7 */
export function isoWeekday(iso: IsoDate): number {
  return ((parse(iso).getUTCDay() + 6) % 7) + 1;
}

/**
 * Start of the working week, honouring the "Week starts on (1=Mon ... 7=Sun)"
 * setting. Mirrors the sheet's
 *   =B - MOD(WEEKDAY(B,2) - weekStartDay, 7)
 */
export function weekStart(iso: IsoDate, weekStartsOn = 1): IsoDate {
  const offset = (isoWeekday(iso) - weekStartsOn + 7) % 7;
  return addDays(iso, -offset);
}

export function weekEnd(iso: IsoDate, weekStartsOn = 1): IsoDate {
  return addDays(weekStart(iso, weekStartsOn), 6);
}

export function monthBounds(month: string): { from: IsoDate; to: IsoDate } {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** Last N months, newest first, as 'YYYY-MM'. */
export function recentMonths(n: number, from = currentMonth()): string[] {
  const [y, m] = from.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export function isFutureBeyond(iso: IsoDate, days: number): boolean {
  return parse(iso).getTime() > parse(today()).getTime() + days * 86_400_000;
}
