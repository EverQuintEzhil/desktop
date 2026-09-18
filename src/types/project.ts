import type { UserType } from '@/types/admin';
import type { ConversationStatus } from '@/types/chat';

export type ProjectScope = 'mine' | 'shared';

export type ProjectActivityKind =
    | 'project_created'
    | 'project_updated'
    | 'file_added'
    | 'file_removed'
    | 'conversation_shared'
    | 'conversation_unshared'
    | 'member_added'
    | 'member_role_changed'
    | 'member_removed';

export type ProjectMemberRole = 'viewer' | 'editor' | 'owner';

export type ProjectMember = {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
    role: ProjectMemberRole;
};

export type ProjectType = {
    readonly _id: string;
    name: string;
    description: string;
    instructions: string;
    /** The agent this project belongs to (needed when uploading files). */
    agentId?: string;
    /** Desktop-only: absolute local folder for space-scoped coding tools. Null when unset. */
    folderPath?: string | null;
    /** Derived: private when nobody other than the owner has access. */
    isPrivate: boolean;
    /** Users the project is shared with (from `members`), including the owner. */
    members: ProjectMember[];
    /** The user who created the space (backend `creator`). */
    creator?: ProjectMember;
    createdAt: string;
    updatedAt: string;
    fileCount?: number;
    pinnedAt?: string | null;
};

export type ProjectFileType = {
    readonly _id: string;
    name: string;
    type: string;
    extension: string;
    size?: number;
    url: string;
    thumbnailUrl?: string;
    embedding_status?: string;
    embedding_error?: string;
    /** Who uploaded it. One of the fields the /files `search` param matches, so it is worth showing. */
    creatorName?: string;
    createdAt: string;
};

export type ProjectChatStatus = ConversationStatus;

export type ProjectChatType = {
    readonly _id: string;
    title: string;
    updatedAt: string | number;
    favorited?: boolean;
    isPublic?: boolean;
    status?: ProjectChatStatus;
    /** The user who created the chat (backend `creator`). Same shape as the project creator. */
    creator?: ProjectMember;
};

export type ProjectActivityType = {
    readonly _id: string;
    type: ProjectActivityKind | string;
    actorName: string;
    data?: Record<string, unknown>;
    createdAt: string | number;
};

// ---- Raw backend shapes (defensive: tolerate snake_case and camelCase) ----

export type RawMember = UserType & { role?: string };

interface RawProject {
    _id: string;
    name?: string;
    description?: string;
    instructions?: string;
    agentId?: string;
    folderPath?: string | null;
    folder_path?: string | null;
    members?: RawMember[];
    creator?: RawMember;
    includeSecurityGroupIds?: string[];
    created_at?: string;
    createdAt?: string;
    updated_at?: string;
    updatedAt?: string;
    fileCount?: number;
    file_count?: number;
    pinnedAt?: string | null;
}

const normalizeRole = (role?: string): ProjectMemberRole => {
    if (role === 'editor') return 'editor';
    if (role === 'owner') return 'owner';

    return 'viewer';
};

export const mapMember = (user: RawMember): ProjectMember => ({
    _id: user._id,
    name: [user.name?.first, user.name?.last].filter(Boolean).join(' ') || user.email || 'User',
    email: user.email ?? '',
    avatar: user.avatar || undefined,
    role: normalizeRole(user.role),
});

interface RawFile {
    _id: string;
    name?: string;
    type?: string;
    mimeType?: string;
    extension?: string;
    size?: number;
    meta?: { size?: number };
    url?: string;
    thumbnail_url?: string;
    embedding_status?: string;
    embedding_error?: string;
    creator_name?: string;
    created_at?: string;
    createdAt?: string;
}

interface RawConversation {
    _id: string;
    title?: string;
    updated_at?: string | number;
    updatedAt?: string | number;
    favorited?: boolean;
    favorited_at?: string | number | null;
    favoritedAt?: string | number | null;
    is_public?: boolean;
    isPublic?: boolean;
    status?: ProjectChatStatus;
    creator?: RawMember;
}

interface RawActivity {
    _id: string;
    type?: string;
    actor_name?: string;
    actorName?: string;
    data?: Record<string, unknown>;
    created_at?: string | number;
    createdAt?: string | number;
}

export const mapProject = (raw: RawProject): ProjectType => {
    const members = (raw.members ?? []).map(mapMember);
    const nonOwnerMembers = members.filter((member) => member.role !== 'owner');

    return {
        _id: raw._id,
        name: raw.name ?? 'Untitled project',
        description: raw.description ?? '',
        instructions: raw.instructions ?? '',
        agentId: raw.agentId,
        isPrivate: nonOwnerMembers.length === 0 && (raw.includeSecurityGroupIds?.length ?? 0) === 0,
        members,
        creator: raw.creator ? mapMember(raw.creator) : undefined,
        createdAt: raw.created_at ?? raw.createdAt ?? '',
        updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
        fileCount: raw.fileCount ?? raw.file_count,
        pinnedAt: raw.pinnedAt ?? null,
    };
};

export const mapMembers = (raw: RawMember[]): ProjectMember[] => raw.map(mapMember);

export const mapProjectFile = (raw: RawFile): ProjectFileType => ({
    _id: raw._id,
    name: raw.name ?? 'Untitled file',
    type: raw.type ?? raw.mimeType ?? 'File',
    extension: (raw.extension ?? raw.name?.split('.').pop() ?? '').replace(/^\./, '').toLowerCase(),
    size: raw.meta?.size ?? raw.size,
    url: raw.url ?? '',
    thumbnailUrl: raw.thumbnail_url,
    embedding_status: raw.embedding_status,
    embedding_error: raw.embedding_error,
    creatorName: raw.creator_name,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
});

export const mapProjectChat = (raw: RawConversation): ProjectChatType => ({
    _id: raw._id,
    title: raw.title ?? 'Untitled',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
    favorited: raw.favorited ?? (raw.favorited_at != null || raw.favoritedAt != null),
    isPublic: raw.is_public ?? raw.isPublic ?? false,
    status: raw.status,
    creator: raw.creator ? mapMember(raw.creator) : undefined,
});

export const mapProjectActivity = (raw: RawActivity): ProjectActivityType => ({
    _id: raw._id,
    type: raw.type ?? 'project_updated',
    actorName: raw.actor_name ?? raw.actorName ?? 'Someone',
    data: raw.data,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
});
