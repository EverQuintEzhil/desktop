import lodash from 'lodash';

import Resolver from '../../resolver';

export interface LodashOptions {
    value?: unknown;
    values?: unknown[];
    operation?: string;
}

const lodashOp = (data: unknown, options: LodashOptions) => {
    const values = options.value ? [options.value] : options.values;
    const operations = lodash as unknown as Record<string, (...values: unknown[]) => unknown>;

    if (values && options.operation && operations[options.operation] && Array.isArray(values) && values.length > 0) {
        return operations[options.operation](...Resolver(data, values));
    }

    return null;
};

export default lodashOp;
