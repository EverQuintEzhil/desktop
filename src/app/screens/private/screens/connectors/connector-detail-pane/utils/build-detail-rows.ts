import type { McpServer } from '@/lib/api';
import { AUTH_TYPE_OPTIONS } from '@/types/admin';

import type { DetailRow } from '../types';

export const getAuthLabel = (authType: string): string =>
    AUTH_TYPE_OPTIONS.find((option) => option.value === authType)?.label ?? authType ?? '—';

export const buildRows = (server: McpServer): DetailRow[] => [
    {
        label: 'Server URL',
        value: server.serverUrl || '—',
        isMono: true,
        canCopy: !!server.serverUrl,
    },
    { label: 'Auth type', value: getAuthLabel(server.authType) },
];
