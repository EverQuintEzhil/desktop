export const getDataStoreAbbr = (name: string): string => {
    const words = name.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
        const initials = words[0][0] + words[1][0];

        return initials
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .slice(0, 2);
    }

    const alphanum = name.replace(/[^a-zA-Z0-9]/g, '');

    return alphanum.toUpperCase().slice(0, 2) || '??';
};
