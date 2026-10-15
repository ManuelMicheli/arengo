// true se `iso` è più recente di `days` giorni rispetto a `now`.
export function isWithinDays(iso: string, days: number, now: number = Date.now()): boolean {
  return now - new Date(iso).getTime() < days * 86_400_000;
}
