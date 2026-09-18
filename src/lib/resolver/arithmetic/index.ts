import Resolver from '../resolver';

import Operators from './operators';

export interface ArithmeticOptions {
    operation?: string;
    values?: unknown;
}

const Arithmetic = (data: unknown, options: ArithmeticOptions) => {
    const operators = Operators as Record<string, (...values: number[]) => number | null>;

    if (options.operation && operators[options.operation] && Array.isArray(options.values)) {
        return operators[options.operation](...Resolver(data, options.values));
    }

    return null;
};

export default Arithmetic;
