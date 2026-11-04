// Test-only accessor for `noUncheckedIndexedAccess` (spec 02, T4): tests must not use `!`.
export const getOrThrow = <T>(items: readonly T[], index: number): T => {
    const item = items[index];

    if (item === undefined) {
        throw new Error(`Expected an item at index ${index}, got undefined`);
    }

    return item;
};
