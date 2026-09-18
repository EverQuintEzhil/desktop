import type Options from './lib-types';
import type { DefaultOptions } from './lib-types';

const defaultOptions: DefaultOptions = {
    symbol: '$',
    separator: ',',
    decimal: '.',
    errorOnInvalid: false,
    precision: 2,
    pattern: '!#',
    negativePattern: '-!#',
    fromCents: false,
};

interface CurrencyInstance {
    intValue: number;
    value: number;
}

const round = (v: number) => Math.round(v);
const pow = (p: number) => Math.pow(10, p);

const groupRegex = /(\d)(?=(\d{3})+\b)/g;
const vedicRegex = /(\d)(?=(\d\d)+\d\b)/g;

const parse = (value: unknown, opts: DefaultOptions, useRounding = true) => {
    let v: number | string = 0;
    const { decimal, errorOnInvalid, precision: decimals, fromCents } = opts;
    const precision = pow(decimals as number);
    const isNumber = typeof value === 'number';
    const isCurrency = value instanceof (currency as unknown as new () => unknown);

    if (isCurrency && fromCents) {
        return (value as CurrencyInstance).intValue;
    }

    if (isNumber || isCurrency) {
        v = isCurrency ? (value as CurrencyInstance).value : (value as number);
    } else if (typeof value === 'string') {
        const regex = new RegExp('[^-\\d' + decimal + ']', 'g'),
            decimalString = new RegExp('\\' + decimal, 'g');

        v = value
            .replace(/\((.*)\)/, '-$1')
            .replace(regex, '')
            .replace(decimalString, '.');
        v = v || 0;
    } else {
        if (errorOnInvalid) {
            throw Error('Invalid Input');
        }
        v = 0;
    }

    if (!fromCents) {
        v = (v as number) * precision;
        v = (v as number).toFixed(4);
    }

    return useRounding ? round(v as number) : v;
};

const currency = (value: number | string, options: Options) => {
    let intValue = 0;
    const settings: DefaultOptions = { ...defaultOptions, ...options };
    const precision = pow(settings.precision as number);

    intValue = parse(value, settings) as number;
    const currentVal = intValue / precision;

    settings.increment = settings.increment || 1 / precision;
    if (settings.useVedic) {
        settings.groups = vedicRegex;
    } else {
        settings.groups = groupRegex;
    }
    const { pattern, negativePattern, symbol, separator, decimal, groups } = settings;
    const split = ('' + currentVal).replace(/^-/, '').split('.');
    const dollars = split[0];
    const cents = split[1];

    return (currentVal >= 0 ? pattern : negativePattern)
        .replace('!', symbol)
        .replace('#', dollars.replace(groups, '$1' + separator) + (cents ? decimal + cents : ''));
};

export default currency;
