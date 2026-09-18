import type { SkillFileApiEntry, SkillFileListItem } from './types';

export const DEFAULT_SKILL_FILE = 'SKILL.md';
export const FILE_EXTENSION_ERROR = 'File name must include an extension, for example "my-file.md".';

export const getDisplayNameFromPath = (path: string) => {
    const parts = path.replace(/\/$/, '').split('/');

    return parts[parts.length - 1];
};

export const normalizeSkillFileEntries = (
    entries: SkillFileApiEntry[] | undefined,
    folderPath: string,
    rootPath: string,
): SkillFileListItem[] => {
    return (entries ?? []).map((f) => {
        const path = (f.path.startsWith(rootPath) ? f.path.substring(rootPath.length) : f.path).replace(/\/$/, '');

        return {
            path,
            isFolder: Boolean(f.metadata?.isFolder || f.isFolder || f.kind === 'folder'),
            isProtected: Boolean(
                f.metadata?.isProtected || f.kind === 'skill-md' || (folderPath === '' && path === DEFAULT_SKILL_FILE),
            ),
            content: f.content,
        };
    });
};

export const sortTreeItems = (items: SkillFileListItem[]) => {
    return [...items].sort((a, b) => {
        if (a.isFolder !== b.isFolder) {
            return a.isFolder ? -1 : 1;
        }

        return getDisplayNameFromPath(a.path).localeCompare(getDisplayNameFromPath(b.path));
    });
};

export const isMarkdownFile = (filename: string) => filename.toLowerCase().endsWith('.md');

// Matches a leading YAML frontmatter block (--- ... ---) including its trailing newline.
const FRONTMATTER_RE = /^\uFEFF?\s*---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/;

// Splits leading YAML frontmatter from the body. `frontmatter` includes the delimiters and its
// trailing newline (empty when there is none); `body` is everything after. `frontmatter + body`
// reproduces the original exactly, so a WYSIWYG editor can protect the frontmatter from its lossy
// markdown round-trip by editing only the body and re-attaching the frontmatter on save.
export const splitFrontmatter = (content: string): { frontmatter: string; body: string } => {
    const match = content.match(FRONTMATTER_RE);

    if (!match) {
        return { frontmatter: '', body: content };
    }

    return { frontmatter: match[0], body: content.slice(match[0].length) };
};

// Removes the leading YAML frontmatter block so the skill metadata isn't shown in the rendered
// markdown view. The raw metadata is still visible in code/edit view.
export const stripFrontmatter = (content: string) => splitFrontmatter(content).body;

export const hasFileExtension = (filename: string) => {
    const name = filename.trim().split('/').pop() || '';

    return /^.+\.[^/.]+$/.test(name);
};

export const getErrorToastMessage = (error: unknown, fallback: string) => {
    const axiosError = error as { response?: { data?: { message?: string }; status?: number } };

    if (axiosError.response?.status === 500) {
        return 'Internal server error, Please try again.';
    }

    return axiosError.response?.data?.message || (error instanceof Error ? error.message : fallback);
};

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

export const isEditableFile = (filename: string) => {
    return (
        isMarkdownFile(filename) ||
        isCodeFile(filename) ||
        filename.toLowerCase().endsWith('.txt') ||
        filename.toLowerCase().endsWith('.csv')
    );
};
