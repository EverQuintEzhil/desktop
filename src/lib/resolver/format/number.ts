export interface FormatNumberOptions {
    decimals?: number;
    percentage?: boolean;
}

const FormatNumber = (value: unknown, options?: FormatNumberOptions) => {
    let v: number | string = parseFloat(value as string);

    if (options?.decimals) {
        v = (v as number).toFixed(options.decimals);
    }
    if (options?.percentage) {
        v = `${v}%`;
    }

    return v;
};

export default FormatNumber;
