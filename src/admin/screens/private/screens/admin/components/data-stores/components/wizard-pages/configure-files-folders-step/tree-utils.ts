import type { BreadcrumbItem, ExplorerFileNode, ExplorerFolderNode, ExplorerNode } from './types';

export function setsEqualString(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const x of a) {
        if (!b.has(x)) return false;
    }

    return true;
}

/**
 * True if `ancestor` is a strict path prefix of `descendant` (folder containment).
 * Empty string is treated as the synthetic root: every non-empty path is under it.
 */
export function isStrictPathAncestor(ancestor: string, descendant: string): boolean {
    if (ancestor === descendant) return false;
    if (ancestor === '') return descendant !== '';

    return descendant.startsWith(`${ancestor}/`);
}

/**
 * Drop any key that is inside another selected key (keep the ancestor only).
 */
export function normalizeSelectionKeys(keys: Iterable<string>): Set<string> {
    const arr = [...keys];

    return new Set(arr.filter((k) => !arr.some((other) => other !== k && isStrictPathAncestor(other, k))));
}

/** Selected in the set, or implied by a strictly selected ancestor path (folder). */
export function isPathSelectedOrUnderSelectedFolder(keyPath: string, selectedKeys: ReadonlySet<string>): boolean {
    if (selectedKeys.has(keyPath)) return true;

    for (const s of selectedKeys) {
        if (isStrictPathAncestor(s, keyPath)) return true;
    }

    return false;
}

/** True when some selected path is a strict ancestor — row is implied by parent; checkbox stays off. */
export function isPathUnderSelectedFolder(keyPath: string, selectedKeys: ReadonlySet<string>): boolean {
    for (const s of selectedKeys) {
        if (isStrictPathAncestor(s, keyPath)) return true;
    }

    return false;
}

export function isFolder(n: ExplorerNode): n is ExplorerFolderNode {
    return n.type === 'folder';
}

function inferKindFromFilename(label: string): string {
    const lower = label.toLowerCase();
    const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : '';

    const map: Record<string, string> = {
        tsx: 'TypeScript',
        ts: 'TypeScript',
        js: 'JavaScript',
        jsx: 'JavaScript',
        json: 'JSON Document',
        md: 'Markdown',
        txt: 'Plain Text',
        pdf: 'PDF Document',
        png: 'PNG image',
        jpg: 'JPEG image',
        jpeg: 'JPEG image',
        zip: 'ZIP archive',
        gif: 'GIF image',
    };

    return map[ext] ?? 'Document';
}

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;

    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function stableDummyDate(keyPath: string): string {
    let h = 0;

    for (let i = 0; i < keyPath.length; i++) {
        h = (h * 31 + keyPath.charCodeAt(i)) | 0;
    }

    const day = 1 + (Math.abs(h) % 28);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return `${day} ${months[Math.abs(h >> 8) % 12]} 2025 at 10:00 AM`;
}

export function getFolderDateDisplay(node: ExplorerFolderNode): string {
    return node.dateModified ?? stableDummyDate(node.keyPath || 'root');
}

/** Tree "Size" column for folders: formatted bytes when provided, otherwise `-`. */
export function getFolderSizeDisplay(node: ExplorerFolderNode): string {
    if (node.sizeBytes == null) return '-';

    return formatBytes(node.sizeBytes);
}

export function getFileColumnMeta(node: ExplorerFileNode): { dateModified: string; size: string; kind: string } {
    const kind = node.kind ?? inferKindFromFilename(node.label);
    const size = node.sizeBytes != null ? formatBytes(node.sizeBytes) : '—';
    const dateModified = node.dateModified ?? stableDummyDate(node.keyPath);

    return { dateModified, size, kind };
}

/**
 * Walk `pathSegments` (e.g. ['documents','archive']) from `root` and return the folder at that path.
 */
export function getFolderAtPath(root: ExplorerFolderNode, pathSegments: string[]): ExplorerFolderNode | null {
    if (pathSegments.length === 0) return root;

    let current: ExplorerFolderNode = root;

    for (let i = 0; i < pathSegments.length; i++) {
        const expectedKey = pathSegments.slice(0, i + 1).join('/');
        const next = current.children.find((c) => isFolder(c) && c.keyPath === expectedKey) as
            | ExplorerFolderNode
            | undefined;

        if (!next) return null;
        current = next;
    }

    return current;
}

/** Breadcrumb when each segment label is the path segment (full paths are split with `/`). */
export function buildBreadcrumbFromPathSegments(pathSegments: string[]): BreadcrumbItem[] {
    const items: BreadcrumbItem[] = [{ label: 'Root', pathSegments: [] }];

    for (let i = 0; i < pathSegments.length; i++) {
        items.push({
            label: pathSegments[i],
            pathSegments: pathSegments.slice(0, i + 1),
        });
    }

    return items;
}

export function buildBreadcrumb(root: ExplorerFolderNode, pathSegments: string[]): BreadcrumbItem[] {
    const items: BreadcrumbItem[] = [{ label: root.label || 'Root', pathSegments: [] }];

    let node = root;

    for (let i = 0; i < pathSegments.length; i++) {
        const expectedKey = pathSegments.slice(0, i + 1).join('/');
        const next = node.children.find((c) => isFolder(c) && c.keyPath === expectedKey) as
            | ExplorerFolderNode
            | undefined;

        if (!next) break;

        items.push({
            label: next.label,
            pathSegments: pathSegments.slice(0, i + 1),
        });
        node = next;
    }

    return items;
}

export function sortChildren(children: ExplorerNode[]): ExplorerNode[] {
    return [...children].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;

        return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
    });
}

export const TREE_ROW_GRID =
    'configure-files-folders-tree-row grid items-center gap-2 border-b border-border last:border-b-0';
