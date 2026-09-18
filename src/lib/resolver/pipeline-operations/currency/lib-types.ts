interface Options {
    symbol?: string;
    separator?: string;
    decimal?: string;
    errorOnInvalid?: boolean;
    precision?: number;
    increment?: number;
    useVedic?: boolean;
    pattern?: string;
    negativePattern?: string;
    fromCents?: boolean;
}

interface DefaultOptions extends Omit<Options, 'increment'> {
    increment?: number;
    groups?: RegExp;
    symbol: string;
    negativePattern: string;
    pattern: string;
}

export type { DefaultOptions };
export type { Options as default };
