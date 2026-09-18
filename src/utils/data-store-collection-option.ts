import type { DataStoreCollection } from '@/types/admin';

// Most providers return a collection as a plain name. The api provider returns one entry per
// OpenAPI operation, where `id` is the operationId to store and `name` is a readable "GET /pets".
const dataStoreCollectionToOption = (option: DataStoreCollection): { value: string; label: string } => {
    if (typeof option === 'string') return { value: option, label: option };

    return { value: option.id ?? option.name, label: option.name ?? option.id };
};

export default dataStoreCollectionToOption;
