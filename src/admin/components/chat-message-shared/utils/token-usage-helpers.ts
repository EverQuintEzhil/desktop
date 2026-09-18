export const getTokenValue = (value: number | null | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;

    return value;
};

export const formatTokenValue = (value: number | null | undefined) => {
    const tokenValue = getTokenValue(value);

    if (tokenValue === null) return null;

    return tokenValue.toLocaleString();
};

export const getTokenPercent = (value: number | null, total: number | null) => {
    if (value === null || total === null || total <= 0) return null;

    return Math.round((value / total) * 100);
};
