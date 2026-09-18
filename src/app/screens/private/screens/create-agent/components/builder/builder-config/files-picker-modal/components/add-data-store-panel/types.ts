import type { Content } from 'vanilla-jsoneditor';

import type { SelectSuggestionItem } from '@/components/ui/select';
import type { ProviderType } from '@/types/admin';

export interface DataStoreFormValues {
    provider: SelectSuggestionItem<ProviderType>;
    name: string;
    description: string;
    refName: string;
    specification: Content;
    connection: Record<string, unknown>;
}
