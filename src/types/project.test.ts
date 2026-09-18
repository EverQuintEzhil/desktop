import { describe, expect, it } from 'vitest';

import { mapProject } from './project';

describe('mapProject folderPath', () => {
    it('maps the camelCase folderPath', () => {
        expect(mapProject({ _id: 'p1', folderPath: '/Users/me/code' }).folderPath).toBe('/Users/me/code');
    });

    it('maps the snake_case folder_path', () => {
        expect(mapProject({ _id: 'p1', folder_path: '/Users/me/code' }).folderPath).toBe('/Users/me/code');
    });

    it('is null when the backend omits it', () => {
        expect(mapProject({ _id: 'p1' }).folderPath).toBeNull();
    });
});
