import type { McpServer } from '@/lib/api';

export const isConnectorOwnedBy = (server: Pick<McpServer, 'creator'>, userId: string | null): boolean =>
    !!server.creator?._id && server.creator._id === userId;
