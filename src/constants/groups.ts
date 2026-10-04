export const GROUP_DEBT_FILTERS = {
    ALL: 'all',
    OWED: 'owed',
    OWES: 'owes',
} as const;

export type GroupDebtFilter =
    (typeof GROUP_DEBT_FILTERS)[keyof typeof GROUP_DEBT_FILTERS];

export const GROUP_CARD_FILTER_BUCKETS = {
    OWED: 'owed',
    OWES: 'owes',
    NEUTRAL: 'neutral',
    SETTLED: 'settled',
    UNAVAILABLE: 'unavailable',
} as const;

export type GroupCardFilterBucket =
    (typeof GROUP_CARD_FILTER_BUCKETS)[keyof typeof GROUP_CARD_FILTER_BUCKETS];

export const GROUP_NET_CONVERSION_STATES = {
    SAME_CURRENCY: 'same-currency',
    CONVERTED: 'converted',
    UNAVAILABLE: 'unavailable',
} as const;

export type GroupNetConversionState =
    (typeof GROUP_NET_CONVERSION_STATES)[keyof typeof GROUP_NET_CONVERSION_STATES];

export const GROUP_SETTLED_AUTO_HIDE_SECONDS = 15 * 24 * 60 * 60;
