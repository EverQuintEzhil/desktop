// Shared file-upload constraints for project files: images, PDF, Word, text,
// Markdown, Excel, PowerPoint. Used by both the project detail Files panel and
// the dedicated project files page.
export const ACCEPTED_FILE_TYPES = 'image/*,.pdf,.doc,.docx,.txt,.md,.markdown,.xls,.xlsx,.ppt,.pptx';

const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'txt', 'md', 'markdown', 'xls', 'xlsx', 'ppt', 'pptx']);

export const isAllowedFile = (file: File): boolean => {
    if (file.type.startsWith('image/')) return true;
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

    return ALLOWED_EXTENSIONS.has(extension);
};

export const unsupportedFilesMessage = (rejected: number): string =>
    rejected === 1
        ? 'Unsupported file type. Allowed: images, PDF, Word, text, Markdown, Excel, PowerPoint.'
        : `${rejected} files have an unsupported type.`;
