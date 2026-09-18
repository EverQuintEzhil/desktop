export const getHostname = (url: string): string => {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
};

export const getFaviconUrl = (url: string): string | undefined => {
    try {
        const origin = new URL(url).origin;

        return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(origin)}&sz=64`;
    } catch {
        return undefined;
    }
};
