export const buildConnectorFaviconUrl = (serverUrl?: string | null, size = 64): string | undefined => {
    if (!serverUrl) {
        return undefined;
    }

    try {
        const { hostname } = new URL(serverUrl);
        const labels = hostname.split('.');
        const rootDomain = labels.length > 2 ? labels.slice(-2).join('.') : hostname;

        return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${rootDomain}&size=${size}`;
    } catch {
        return undefined;
    }
};
