import { describe, expect, it } from 'vitest';

import { buildOkfTree, collectOkfFolderPaths, type OkfFile } from './okf-tree';

const asFiles = (paths: string[]): OkfFile[] => paths.map((path) => ({ path, content: '' }));

describe('buildOkfTree', () => {
    it('keeps a flat bundle flat', () => {
        const tree = buildOkfTree(asFiles(['index.md', 'store.md']));

        expect(tree.map((node) => [node.name, node.isFolder])).toEqual([
            ['index.md', false],
            ['store.md', false],
        ]);
    });

    it('nests files under the folders in their path', () => {
        const tree = buildOkfTree(asFiles(['store.md', 'collections/todos.md']));

        expect(tree).toHaveLength(2);

        const [folder, file] = tree;

        // Folders sort ahead of files at every level.
        expect(folder).toMatchObject({ name: 'collections', path: 'collections', isFolder: true });
        expect(file).toMatchObject({ name: 'store.md', path: 'store.md', isFolder: false });
        expect(folder.children).toEqual([
            {
                name: 'todos.md',
                path: 'collections/todos.md',
                isFolder: false,
                children: [],
            },
        ]);
    });

    it('reuses one folder node for files that share a prefix, at any depth', () => {
        const tree = buildOkfTree(asFiles(['a/b/deep.md', 'a/b/deeper.md', 'a/top.md']));

        expect(tree).toHaveLength(1);
        expect(tree[0].name).toBe('a');

        const [nested, topFile] = tree[0].children;

        expect(nested).toMatchObject({ name: 'b', path: 'a/b', isFolder: true });
        expect(topFile).toMatchObject({ name: 'top.md', isFolder: false });
        expect(nested.children.map((node) => node.name)).toEqual(['deep.md', 'deeper.md']);
    });

    it('sorts folders before files and each group alphabetically', () => {
        const tree = buildOkfTree(asFiles(['SKILL.md', 'templates/one.md', 'LICENSE.txt', 'assets/logo.md']));

        expect(tree.map((node) => node.name)).toEqual(['assets', 'templates', 'LICENSE.txt', 'SKILL.md']);
    });

    it('ignores empty path segments', () => {
        const tree = buildOkfTree(asFiles(['/leading.md', 'a//b.md']));

        expect(tree.map((node) => node.name)).toEqual(['a', 'leading.md']);
        expect(tree[0].children.map((node) => node.name)).toEqual(['b.md']);
    });
});

describe('collectOkfFolderPaths', () => {
    it('returns every folder prefix once, excluding the file itself', () => {
        const paths = collectOkfFolderPaths(asFiles(['a/b/c.md', 'a/d.md', 'top.md']));

        expect([...paths].sort()).toEqual(['a', 'a/b']);
    });

    it('returns nothing for a flat bundle', () => {
        expect(collectOkfFolderPaths(asFiles(['index.md']))).toEqual([]);
    });
});
