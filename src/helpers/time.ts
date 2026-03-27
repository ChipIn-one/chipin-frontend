import { DAY, HOUR, MINUTE, SECOND } from 'constants/time';

type TimeUnit = Intl.RelativeTimeFormatUnit;

const MAX_RELATIVE_DAYS = 7; // Relative time limit in days

const UNITS: Array<[TimeUnit, number]> = [
    ['day', DAY],
    ['hour', HOUR],
    ['minute', MINUTE],
    ['second', SECOND],
];

const rtf = new Intl.RelativeTimeFormat('en', {
    numeric: 'auto',
    // Locale can be changed:
    // new Intl.RelativeTimeFormat(navigator.language)
});

const dateFormatter = new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    // Locale can be changed:
    // new Intl.DateTimeFormat(navigator.language)
});

export const formatRelativeTime = (date: Date | number): string => {
    const target = typeof date === 'number' ? date : date.getTime();
    const diff = target - Date.now();

    // Switch to absolute date if difference exceeds relative threshold
    if (Math.abs(diff) > MAX_RELATIVE_DAYS * DAY) {
        return dateFormatter.format(new Date(target));
    }

    for (const [unit, ms] of UNITS) {
        const value = Math.round(diff / ms);

        if (Math.abs(value) >= 1) {
            return rtf.format(value, unit);
        }
    }

    return 'just now';
};

export const getUnixTimestampInSec = (date?: Date): number =>
    Math.floor((date ? date.getTime() : Date.now()) / 1000);
