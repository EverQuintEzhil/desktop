import type { ArtifactType, ArtifactVersion } from './artifact-types';

const TYPE_EXTENSIONS: Record<ArtifactType, string> = {
    html: 'html',
    svg: 'svg',
    mermaid: 'mmd',
    markdown: 'md',
    code: 'txt',
};

const LANGUAGE_EXTENSIONS: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    markdown: 'md',
    yaml: 'yml',
    shell: 'sh',
    bash: 'sh',
    rust: 'rs',
    ruby: 'rb',
    kotlin: 'kt',
    csharp: 'cs',
    'c++': 'cpp',
};

const MIME_TYPES: Record<string, string> = {
    html: 'text/html',
    svg: 'image/svg+xml',
    md: 'text/markdown',
};

const SAFE_FILENAME = /[^a-z0-9]+/gi;

const BARE_WORD = /^[a-z0-9]+$/;

export const artifactExtension = (version: Pick<ArtifactVersion, 'artifactType' | 'language'>): string => {
    if (version.artifactType !== 'code') return TYPE_EXTENSIONS[version.artifactType];

    const language = version.language?.toLowerCase();

    if (!language) return TYPE_EXTENSIONS.code;

    return LANGUAGE_EXTENSIONS[language] ?? (BARE_WORD.test(language) ? language : TYPE_EXTENSIONS.code);
};

export const artifactFileName = (version: Pick<ArtifactVersion, 'title' | 'artifactType' | 'language'>): string => {
    const stem = version.title
        .trim()
        .replace(SAFE_FILENAME, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

    return `${stem || 'artifact'}.${artifactExtension(version)}`;
};

export const downloadArtifact = (version: ArtifactVersion): void => {
    const extension = artifactExtension(version);
    const blob = new Blob([version.content], { type: `${MIME_TYPES[extension] ?? 'text/plain'};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = artifactFileName(version);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};
