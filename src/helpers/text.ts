export const isInputCloseToLimit = (length: number, maxLength: number): boolean => {
    return length >= maxLength * 0.8;
};
