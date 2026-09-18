import { z } from 'zod';

import { artifactTypeSchema, type ArtifactType } from '@/lib/api/app/artifact';

export type { ArtifactHead, ArtifactType, ArtifactVersion, ArtifactVersionMeta } from '@/lib/api/app/artifact';

export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
    html: 'Web page',
    svg: 'Image',
    mermaid: 'Diagram',
    markdown: 'Document',
    code: 'Code',
};

export const ARTIFACT_TYPES: ArtifactType[] = [...artifactTypeSchema.options];

export type ArtifactViewMode = 'preview' | 'code';

export const PREVIEWABLE_ARTIFACT_TYPES = new Set<ArtifactType>(['html', 'svg', 'markdown', 'mermaid']);

const LANGUAGE_LABELS: Record<string, string> = {
    css: 'CSS',
    csharp: 'C#',
    html: 'HTML',
    javascript: 'JavaScript',
    json: 'JSON',
    jsx: 'JSX',
    php: 'PHP',
    sql: 'SQL',
    svg: 'SVG',
    tsx: 'TSX',
    typescript: 'TypeScript',
    xml: 'XML',
    yaml: 'YAML',
};

const languageLabel = (language: string): string =>
    LANGUAGE_LABELS[language.toLowerCase()] ?? language.charAt(0).toUpperCase() + language.slice(1);

export const artifactTypeLabel = (artifactType?: ArtifactType, language?: string | null): string => {
    if (language) return languageLabel(language);

    return artifactType ? ARTIFACT_TYPE_LABELS[artifactType] : 'Artifact';
};

const artifactPointerSchema = z.object({
    toolCallId: z.string().min(1),
    artifactId: z.string().min(1),
    slug: z.string().min(1),
    title: z.string(),
    artifactType: artifactTypeSchema,
    language: z.string().min(1).nullish(),
    versionNumber: z.number().int().positive(),
});

export type ArtifactPointer = z.infer<typeof artifactPointerSchema>;

interface MessagePart {
    type: string;
    name?: string;
    data?: unknown;
}

export const readArtifactPointer = (part: MessagePart): ArtifactPointer | null => {
    if (part.type !== 'data' || part.name !== 'artifact') return null;

    const parsed = artifactPointerSchema.safeParse(part.data);

    return parsed.success ? parsed.data : null;
};

export const isArtifactDataPart = (part: MessagePart, toolCallId: string): boolean =>
    readArtifactPointer(part)?.toolCallId === toolCallId;
