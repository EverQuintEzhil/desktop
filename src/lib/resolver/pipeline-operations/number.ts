import Resolver from '../resolver';

export interface NumberOptions {
    value?: unknown;
    operation?: string;
    arguments?: unknown[];
}

const number = (data: unknown, options: NumberOptions) => {
    if (options.value) {
        const resolvedValue = Resolver(data, options.value);

        if (typeof resolvedValue === 'number' && options.operation) {
            const value = Number(resolvedValue) as unknown as Record<string, (...values: unknown[]) => unknown>;

            return value[options.operation](...(options.arguments || []));
        }
    }

    return null;
};

export default number;
