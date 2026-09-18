export const isMarkdownFile = (filename: string) => filename.toLowerCase().endsWith('.md');

export const isCodeFile = (filename: string) => {
    const codeExtensions = [
        '.js',
        '.jsx',
        '.ts',
        '.tsx',
        '.py',
        '.json',
        '.html',
        '.css',
        '.scss',
        '.yaml',
        '.yml',
        '.sh',
        '.bash',
        '.lua',
        '.cpp',
        '.c',
        '.java',
        '.go',
        '.rs',
    ];

    return codeExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
};

export const isViewableTextFile = (filename: string) => {
    return (
        isMarkdownFile(filename) ||
        isCodeFile(filename) ||
        filename.toLowerCase().endsWith('.txt') ||
        filename.toLowerCase().endsWith('.csv')
    );
};

export const isImageFile = (filename: string) => {
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp'].some((ext) =>
        filename.toLowerCase().endsWith(ext),
    );
};
