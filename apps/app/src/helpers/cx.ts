/** Joins class names, skipping empty ones: `cx(styles.root, className)` (spec 05 §3). */
const cx = (...names: Array<string | false | null | undefined>): string =>
    names.filter(Boolean).join(' ');

export { cx };
