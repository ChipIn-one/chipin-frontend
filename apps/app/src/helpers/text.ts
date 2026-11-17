export const isInputCloseToLimit = (length: number, maxLength: number): boolean => {
    return length >= maxLength * 0.8;
};

export const getFilterFunction = (query: string) => {
    const queryLowerCase = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    if (queryLowerCase.length === 0) {
        return null;
    }

    return (entities: string[]) =>
        queryLowerCase.every(string =>
            entities.some(entity => entity.toLowerCase().includes(string)),
        );
};
