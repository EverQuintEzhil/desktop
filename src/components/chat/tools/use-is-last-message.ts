import { useAuiState } from '@assistant-ui/react';

/**
 * Whether the message this component renders inside is the last one in the thread. Human tool
 * cards use it to stop accepting input once the conversation has moved past them — an answer
 * submitted from an older message has no run to resume and would go nowhere.
 *
 * Reading `s.message` outside a message scope throws (the proxied state invokes the scope
 * accessor), so the `in` check is load-bearing: it keeps a tool renderer usable standalone, which
 * SDK consumers can do. Defaults to true there, matching "answerable unless known otherwise".
 */
export const useIsLastMessage = (): boolean =>
    useAuiState((state) => ('message' in state ? state.message.isLast : true));
