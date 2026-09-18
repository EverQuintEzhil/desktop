import { describe, expect, it } from 'vitest';

import { dataStoreProviderFilter } from './data-stores';

describe('dataStoreProviderFilter', () => {
    it('maps the api provider to the api group', () => {
        expect(dataStoreProviderFilter('api')).toBe('api');
    });

    it('maps weblinks to its own group', () => {
        expect(dataStoreProviderFilter('weblinks')).toBe('weblinks');
    });

    it('maps file/blob-storage providers to the blob-storage group', () => {
        expect(dataStoreProviderFilter('files')).toBe('blob-storage');
        expect(dataStoreProviderFilter('azure-blob-storage')).toBe('blob-storage');
        expect(dataStoreProviderFilter('s3')).toBe('blob-storage');
        expect(dataStoreProviderFilter('sharepoint')).toBe('blob-storage');
    });

    it('falls back to db for every other provider', () => {
        expect(dataStoreProviderFilter('mongodb')).toBe('db');
        expect(dataStoreProviderFilter('postgresql')).toBe('db');
        expect(dataStoreProviderFilter('custom')).toBe('db');
        expect(dataStoreProviderFilter(undefined)).toBe('db');
    });
});
