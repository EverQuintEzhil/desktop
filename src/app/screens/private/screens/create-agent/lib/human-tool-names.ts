// Tools answered by the user in the chat UI rather than executed by code. The runtime resumes a
// parked run once one of these has an answer, and conversation restore must leave their dangling
// parts unsettled so the card renders as answerable again. Frontend tools must not be listed,
// since those execute on their own.
export const HUMAN_TOOL_NAMES: ReadonlySet<string> = new Set([
    'ask_user',
    'request_input',
    'confirm_action',
    'collect_data_store_credentials',
]);
