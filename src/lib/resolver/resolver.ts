import Format from './format';
import Pipeline from './pipeline';
import ResolveStringPath from './resolve-string-path';

interface ResolvePath {
    __CONSOLE?: unknown;
    __RESOLVE?: unknown;
    __VALUE?: unknown;
    __PATH?: unknown;
    __DEFAULT?: unknown;
    __DESTRUCTURE?: boolean;
    __PIPELINE?: unknown;
    __OPTIONS?: unknown;
    __ESCAPE?: unknown;
    [key: string]: unknown;
}

const Resolver = (data: unknown, path: unknown): any => {
    const formatters = Format as unknown as Record<string, (value: unknown, options?: unknown) => unknown>;

    if (typeof path === 'undefined' || path === null) {
        return path;
    }
    const node = path as ResolvePath;

    if (node.__CONSOLE) {
        const val = Resolver(data, node.__CONSOLE);

        return val;
    }
    if (typeof path === 'object' && path instanceof Date) {
        return path;
    }
    if (typeof path !== 'string' && typeof path !== 'object') {
        return path;
    }
    if (typeof path === 'string' && path.indexOf('$data') === -1) {
        return path;
    }
    if (path === '$data') {
        return data;
    }
    if (typeof path === 'string') {
        return ResolveStringPath(data, path, true);
    }
    if (typeof path === 'object' && Array.isArray(path)) {
        return path.map((v: unknown) => Resolver(data, v));
    }
    if (typeof path === 'object' && !node.__RESOLVE) {
        return Object.entries(path).reduce((acc, [key]) => {
            const value = Resolver(data, node[key]);

            if (key.indexOf('$data.') !== -1) {
                return {
                    ...acc,
                    [Resolver(data, key)]: value,
                };
            }

            return {
                ...acc,
                [key]: value,
            };
        }, {});
    }
    if (node.__RESOLVE === 'ESCAPE') {
        return node.__VALUE;
    }
    if (!node.__PATH) {
        return node.__DEFAULT || null;
    }
    let resolvedValue;

    if (node.__PATH === '$data') {
        resolvedValue = data;
    } else if (typeof node.__PATH === 'string') {
        resolvedValue = ResolveStringPath(data, node.__PATH, node.__DESTRUCTURE);
    } else if (typeof node.__PATH === 'object' && !Array.isArray(node.__PATH)) {
        resolvedValue = Object.entries(node.__PATH as Record<string, unknown>).reduce(
            (previousValue: Record<string, unknown>, [key, pathValue]) => ({
                ...previousValue,
                [key]: Resolver(data, pathValue),
            }),
            {},
        );
    } else if (typeof node.__PATH === 'object' && Array.isArray(node.__PATH)) {
        resolvedValue = node.__PATH.map((v: string) => ResolveStringPath(data, v));
    }
    if (node.__PIPELINE && resolvedValue) {
        resolvedValue = Pipeline(resolvedValue, node.__PIPELINE as Record<string, unknown>[]);
    }
    if (typeof resolvedValue !== 'undefined' && node.__RESOLVE && formatters[node.__RESOLVE as string]) {
        resolvedValue = formatters[node.__RESOLVE as string](resolvedValue, node.__OPTIONS);
    }
    if (!resolvedValue && typeof node.__DEFAULT !== 'undefined') {
        resolvedValue = node.__DEFAULT;
    }
    if (node.__ESCAPE) {
        return resolvedValue;
    }

    return Resolver(data, resolvedValue);
};

export default Resolver;
