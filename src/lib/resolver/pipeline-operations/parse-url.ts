import Resolver from '../resolver';

export interface ParseURLOptions {
    url?: unknown;
    return?: unknown;
}

const parseURL = (data: unknown, options: ParseURLOptions): unknown => {
    const url = Resolver(data, options.url);

    if (!url) {
        return null;
    }

    const parsedURL = new URL(url);
    const value = {
        protocols: parsedURL.protocol ? [parsedURL.protocol.replace(':', '')] : [],
        protocol: parsedURL.protocol.replace(':', ''),
        resource: parsedURL.hostname,
        user: parsedURL.username,
        pathname: parsedURL.pathname,
        hash: parsedURL.hash.replace('#', ''),
        search: parsedURL.search,
        href: parsedURL.href,
        port: parsedURL.port,
        query: Object.fromEntries(parsedURL.searchParams.entries()),
    };

    return Resolver(value, options.return);
};

export default parseURL;
