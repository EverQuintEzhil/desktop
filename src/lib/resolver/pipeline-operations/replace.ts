export interface ReplaceOptions {
    search: string | RegExp;
    value: string;
}

const replace = (data: string, options: ReplaceOptions) => data.replace(options.search, options.value);

export default replace;
