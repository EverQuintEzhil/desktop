import type { DataStoreType } from '@/types/admin';

export interface Props {
    dataStore: DataStoreType;
    canUserEdit: boolean;
    renderLibraryImport?: (helpers: { onImportFiles: (files: File[]) => void }) => React.ReactNode;
}
