import { DAY, HOUR, MINUTE, SECOND } from 'constants/time';

type DateInput = Date | number;

const RELATIVE_TIME_LIMIT = HOUR;
const RELATIVE_TIME_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
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

export const formatRelativeTime = (
    date: DateInput,
    locale: string,
    is24Hour: boolean,
): string => {
    const timestamp = toTimestampMs(date);
    const diff = timestamp - Date.now();

    if (Math.abs(diff) >= RELATIVE_TIME_LIMIT) {
        return new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
            hour12: !is24Hour,
        }).format(new Date(timestamp));
    }

    const relativeTimeFormat = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    for (const [unit, ms] of RELATIVE_TIME_UNITS) {
        const value = Math.round(diff / ms);

        if (Math.abs(value) >= 1) {
            return relativeTimeFormat.format(value, unit);
        }
    }

    return relativeTimeFormat.format(0, 'second');
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

export const formatUtcOffset = (offsetMinutes: number): string => {
    const sign = offsetMinutes <= 0 ? '+' : '-';
    const absoluteOffset = Math.abs(offsetMinutes);
    const hours = Math.floor(absoluteOffset / 60);
    const minutes = absoluteOffset % 60;

    return `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const getAmPm24Time = (date: Date, is24Hour = true): string => {
    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: !is24Hour,
        timeZone: detectDeviceTimezone(),
    });
};
