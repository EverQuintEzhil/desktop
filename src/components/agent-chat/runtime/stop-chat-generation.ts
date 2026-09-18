interface StopChatGenerationArgs {
    agentId: string;
    conversationId: string;
    baseUrl: string;
    fetch: typeof fetch;
    credentials?: RequestCredentials;
}

export async function stopChatGeneration({
    agentId,
    conversationId,
    baseUrl,
    fetch: hostFetch,
    credentials,
}: StopChatGenerationArgs): Promise<void> {
    await hostFetch(`${baseUrl}/ai/chat/stop`, {
        method: 'POST',
        credentials,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, conversationId }),
    });
}
