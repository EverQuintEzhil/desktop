export const ARTIFACT_SEARCH_PARAM = 'artifact';

export const artifactPagePath = (agentSlug: string, artifactId: string): string =>
    `/agent/${encodeURIComponent(agentSlug)}/artifact/${encodeURIComponent(artifactId)}`;

export const artifactPageLink = (agentSlug: string, artifactId: string): string =>
    `${window.location.origin}${artifactPagePath(agentSlug, artifactId)}`;

export const artifactConversationPath = (agentSlug: string, conversationId: string, artifactSlug: string): string =>
    `/agent/${encodeURIComponent(agentSlug)}/chat/${encodeURIComponent(conversationId)}?${ARTIFACT_SEARCH_PARAM}=${encodeURIComponent(artifactSlug)}`;
