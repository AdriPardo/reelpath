/** Zonas IANA frecuentes para ES / LATAM / US (+ UTC). */
export const PLANNER_TIMEZONES = [
  'Europe/Madrid',
  'Atlantic/Canary',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/Mexico_City',
  'America/Monterrey',
  'America/Bogota',
  'America/Lima',
  'America/Guayaquil',
  'America/Caracas',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'UTC',
] as const;

export function plannerTimezoneOptions(current?: string | null): string[] {
  const value = current?.trim();
  if (value && !(PLANNER_TIMEZONES as readonly string[]).includes(value)) {
    return [value, ...PLANNER_TIMEZONES];
  }
  return [...PLANNER_TIMEZONES];
}
