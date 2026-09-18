import { z } from 'zod';

export interface DocumentationLink {
    id: string;
    label: string;
    url: string;
}

/**
 * `id` exists only to key and reorder rows in the admin form. Anything that writes this value from
 * outside the form — a seed, a migration, a direct API call — has no reason to mint one, so a row
 * without it is backfilled rather than dropped: dropping it would hide the row from the admin and
 * then delete it on their next save.
 */
const documentationLinkSchema = z.object({
    id: z.string().min(1).optional(),
    label: z.string().min(1),
    url: z.string().min(1),
});

export const createDocumentationLinkId = (): string => crypto.randomUUID();

export const createDocumentationLink = (): DocumentationLink => ({
    id: createDocumentationLinkId(),
    label: '',
    url: '',
});

/**
 * Rows are authored one at a time in the admin form, so a half-filled or malformed one is expected
 * rather than exceptional: it is dropped and the rest of the list still renders.
 */
export const parseDocumentationLinks = (value: unknown): DocumentationLink[] => {
    if (!Array.isArray(value)) return [];

    return value.flatMap((entry, index) => {
        const parsed = documentationLinkSchema.safeParse(entry);

        if (!parsed.success) return [];

        // Derived from the position rather than generated, so parsing the same stored value twice
        // yields equal rows and the admin form's dirty check stays honest.
        return [{ ...parsed.data, id: parsed.data.id ?? `link-${index}` }];
    });
};

/** The stored order is the menu order, so admin edits keep their positions rather than being sorted. */
export const normaliseDocumentationLinks = (links: DocumentationLink[]): DocumentationLink[] =>
    links
        .map((link) => ({ id: link.id, label: link.label.trim(), url: link.url.trim() }))
        .filter((link) => link.label && link.url);
