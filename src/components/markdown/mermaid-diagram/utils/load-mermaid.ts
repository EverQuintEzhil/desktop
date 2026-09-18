let mermaidLoadPromise: Promise<typeof import('mermaid').default> | null = null;

export const loadMermaid = (): Promise<typeof import('mermaid').default> => {
    if (!mermaidLoadPromise) {
        mermaidLoadPromise = import('mermaid').then((module) => module.default);
    }

    return mermaidLoadPromise;
};
