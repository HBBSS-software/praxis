import { appConfig } from './config';

function parseTimezoneOffsetMinutes(timezone = appConfig.timezone) {
  const normalized = timezone.trim().toUpperCase();
  const match = normalized.match(/^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/) ?? normalized.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);

  if (!match) {
    return 8 * 60;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);

  if (!Number.isInteger(hours) || hours > 14 || !Number.isInteger(minutes) || minutes > 59) {
    return 8 * 60;
  }

  return sign * (hours * 60 + minutes);
}

export function toZonedDate(date = new Date(), timezone = appConfig.timezone) {
  return new Date(date.getTime() + parseTimezoneOffsetMinutes(timezone) * 60_000);
}

export function getZonedDateString(date = new Date(), timezone = appConfig.timezone) {
  const zoned = toZonedDate(date, timezone);
  return `${zoned.getUTCFullYear()}-${String(zoned.getUTCMonth() + 1).padStart(2, '0')}-${String(zoned.getUTCDate()).padStart(2, '0')}`;
}

export function getZonedMonthString(date = new Date(), timezone = appConfig.timezone) {
  const zoned = toZonedDate(date, timezone);
  return `${zoned.getUTCFullYear()}-${String(zoned.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function zonedDateStartIso(dateText: string, timezone = appConfig.timezone) {
  const offset = parseTimezoneOffsetMinutes(timezone);
  return new Date(`${dateText}T00:00:00.000Z`).getTime() - offset * 60_000;
}

export function startOfTodayIso(timezone = appConfig.timezone) {
  return new Date(zonedDateStartIso(getZonedDateString(new Date(), timezone), timezone)).toISOString();
}

export function recentZonedMonths(count: number, timezone = appConfig.timezone) {
  const currentMonth = getZonedMonthString(new Date(), timezone);
  const start = new Date(`${currentMonth}-01T00:00:00.000Z`);
  start.setUTCMonth(start.getUTCMonth() - count + 1);

  return Array.from({ length: count }, (_, index) => {
    const next = new Date(start);
    next.setUTCMonth(start.getUTCMonth() + index);
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

export function zonedMonthRangeIso(month: string, timezone = appConfig.timezone) {
  const offset = parseTimezoneOffsetMinutes(timezone);
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  return {
    start: new Date(start.getTime() - offset * 60_000).toISOString(),
    end: new Date(end.getTime() - offset * 60_000).toISOString()
  };
}
