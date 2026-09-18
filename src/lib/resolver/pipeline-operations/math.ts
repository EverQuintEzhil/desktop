import Resolver from '../resolver';

export interface MathOptions {
    value?: unknown;
    values?: unknown[];
    operation?: string;
}

const math = (data: unknown, options: MathOptions) => {
    const values = options.value ? [options.value] : options.values;
    const operations = Math as unknown as Record<string, (...values: unknown[]) => unknown>;

    if (values && options.operation && operations[options.operation] && Array.isArray(values) && values.length > 0) {
        return operations[options.operation](...Resolver(data, values));
    }

    return null;
};

export default math;
