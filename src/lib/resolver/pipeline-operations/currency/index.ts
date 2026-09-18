import Resolver from '../../resolver';

import Currency from './lib';

export interface CurrencyOptions {
    value?: unknown;
    format?: unknown;
}

const currency = (data: unknown, options: CurrencyOptions) => {
    let { value } = options;
    const { format } = options;

    if (value && format) {
        value = Resolver(data, options.value);

        return Currency(value as string | number, Resolver(data, format));
    }

    return null;
};

export default currency;
