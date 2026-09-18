import Resolver from '../resolver';

export interface StringOptions {
    value?: unknown;
    operation?: string;
    arguments?: unknown[];
}

const string = (data: unknown, options: StringOptions) => {
    if (options.value) {
        const resolvedValue = Resolver(data, options.value);

        if (typeof resolvedValue === 'string' && options.operation) {
            const value = String(resolvedValue) as unknown as Record<string, (...values: unknown[]) => unknown>;

            return value[options.operation](...(options.arguments || []));
        }
    }

    return null;
};

export default string;
