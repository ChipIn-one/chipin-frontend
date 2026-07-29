import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { HOUR, MINUTE } from 'constants/time';

import { formatRelativeTime, getAmPm24Time } from './time';

const activityDate = new Date(2026, 6, 27, 20, 5);

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

test('formats activity time relatively for less than one hour', () => {
    vi.setSystemTime(activityDate.getTime() + 59 * MINUTE);

    expect(formatRelativeTime(activityDate, 'en-US', true)).toBe('59 minutes ago');
});

test('formats activity time in 24-hour format from one hour onward', () => {
    vi.setSystemTime(activityDate.getTime() + HOUR);

    expect(formatRelativeTime(activityDate, 'en-GB', true)).toBe('27 July at 20:05');
});

test('formats activity time in 12-hour format from one hour onward', () => {
    vi.setSystemTime(activityDate.getTime() + HOUR);

    expect(formatRelativeTime(activityDate, 'en-US', false)).toBe('July 27 at 08:05 PM');
});

test('maps the is24Hour flag to Intl hour12 correctly', () => {
    expect(getAmPm24Time(activityDate, true)).toBe('20:05');
    expect(getAmPm24Time(activityDate, false)).toBe('08:05 PM');
});
