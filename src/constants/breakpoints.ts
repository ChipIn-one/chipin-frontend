const RADIX_BREAKPOINTS = {
    xs: 520,
    sm: 768,
} as const;

const MEDIA_QUERIES = {
    fromXs: `(min-width: ${RADIX_BREAKPOINTS.xs}px)`,
    belowSm: `(max-width: ${RADIX_BREAKPOINTS.sm - 1}px)`,
} as const;

export { MEDIA_QUERIES };
