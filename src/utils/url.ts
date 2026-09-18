export const getBaseDomain = (url: string) => {
    if (!url) return '';

    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;
        const domainParts = hostname.split('.');

        return domainParts.length > 2 ? domainParts[domainParts.length - 2] : domainParts[0];
    } catch {
        return '';
    }
};

export const getSafeHttpUrl = (url: string): string | null => {
    if (!url) return null;

    try {
        const parsedUrl = new URL(url);

        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return null;
        }

        return parsedUrl.href;
    } catch {
        return null;
    }
};
