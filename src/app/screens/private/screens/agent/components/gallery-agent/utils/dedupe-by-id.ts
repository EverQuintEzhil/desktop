export const dedupeById = <T extends { _id: string }>(items: T[]): T[] => {
    const seen = new Set<string>();
    const result: T[] = [];

    for (const item of items) {
        if (seen.has(item._id)) continue;
        seen.add(item._id);
        result.push(item);
    }

    return result;
};
