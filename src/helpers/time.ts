import { DAY, HOUR, MINUTE, SECOND } from 'constants/time';

type TimeUnit = Intl.RelativeTimeFormatUnit;
type DateInput = Date | number;

const MAX_RELATIVE_DAYS = 7; // Relative time limit in days

const UNITS: Array<[TimeUnit, number]> = [
    ['day', DAY],
    ['hour', HOUR],
    ['minute', MINUTE],
    ['second', SECOND],
];

const toTimestampMs = (date: DateInput): number =>
    typeof date === 'number' ? date * SECOND : date.getTime();

export const formatActivityAbsoluteDate = (date: DateInput, locale: string): string => {
    return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(new Date(toTimestampMs(date)));
};

export const formatRelativeTime = (date: DateInput, locale: string): string => {
    const timestamp = toTimestampMs(date);
    const diff = timestamp - Date.now();
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    // Switch to absolute date if difference exceeds relative threshold
    if (Math.abs(diff) > MAX_RELATIVE_DAYS * DAY) {
        return formatActivityAbsoluteDate(date, locale);
    }

    for (const [unit, ms] of UNITS) {
        const value = Math.round(diff / ms);

        if (Math.abs(value) >= 1) {
            return rtf.format(value, unit);
        }
    }

    return rtf.format(0, 'second');
};

export const getActivityDateKey = (date: DateInput): string => {
    const value = new Date(toTimestampMs(date));
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

interface ActivityDateDividerLabels {
    today: string;
    yesterday: string;
}

export const formatActivityDateDivider = (
    date: DateInput,
    locale: string,
    labels: ActivityDateDividerLabels,
): string => {
    const timestamp = toTimestampMs(date);
    const targetDate = new Date(timestamp);
    const todayDate = new Date();
    const targetDayStart = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
    ).getTime();
    const todayStart = new Date(
        todayDate.getFullYear(),
        todayDate.getMonth(),
        todayDate.getDate(),
    ).getTime();
    const dayDiff = Math.round((targetDayStart - todayStart) / DAY);

    if (dayDiff === 0) {
        return labels.today;
    }

    if (dayDiff === -1) {
        return labels.yesterday;
    }

    return formatActivityAbsoluteDate(date, locale);
};

export const getUnixTimestampInSec = (date?: Date): number =>
    Math.floor((date ? date.getTime() : Date.now()) / 1000);

export const detectDeviceTimezone = (): string => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
};

export const getAmPm24Time = (date: Date, is24h = true): string => {
    // TODO: Pass localte to localeTimeString from user settings.
    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: is24h,
        timeZone: detectDeviceTimezone(),
    });
};
