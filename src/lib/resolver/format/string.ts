export interface FormatStringOptions {
    delimiter?: string;
}

const FormatString = (value: unknown, options?: FormatStringOptions) => {
    if (typeof value === 'object' && Array.isArray(value)) {
        return value.join(options?.delimiter || ', ');
    }

    return value || '';
};

export default FormatString;
