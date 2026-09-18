import type { McpServer } from '@/lib/api';

export const isConnectorEnabled = (server?: Pick<McpServer, 'preference' | 'globalEnabled'> | null): boolean =>
    server?.preference ? !server.preference.disabled : server?.globalEnabled !== false;
