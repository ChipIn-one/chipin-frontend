import { DAY, HOUR, MINUTE, SECOND } from 'constants/time';

type TimeUnit = Intl.RelativeTimeFormatUnit;

const MAX_RELATIVE_DAYS = 7; // Relative time limit in days

// TODO: Use user language.
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
    const timestamp = typeof date === 'number' ? date * 1000 : date.getTime();

    const diff = timestamp - Date.now();

    // Switch to absolute date if difference exceeds relative threshold
    if (Math.abs(diff) > MAX_RELATIVE_DAYS * DAY) {
        return dateFormatter.format(new Date(timestamp));
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

export type GreetingPeriod = 'morning' | 'day' | 'evening' | 'night';

export const getGreetingPeriod = (): GreetingPeriod => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
        return 'morning';
    }

    if (hour >= 12 && hour < 17) {
        return 'day';
    }

    if (hour >= 17 && hour < 22) {
        return 'evening';
    }

    return 'night';
};
