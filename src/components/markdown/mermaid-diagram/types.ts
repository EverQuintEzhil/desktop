export type MermaidViewMode = 'preview' | 'code';

export type MermaidErrorHash = {
    expected?: string[];
    text?: string;
    token?: string;
    line?: number;
    loc?: {
        first_line?: number;
        first_column?: number;
    };
};

export type MermaidErrorLike = {
    message?: string;
    str?: string;
    hash?: MermaidErrorHash;
};
