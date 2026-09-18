export const LIST_PAGE_SIZE = 20;
export const PINNED_PAGE_SIZE = 30;
export const DETAIL_PAGE_SIZE = 25;
// Delay before refetching project files after an upload — gives the backend time
// to index the file so it appears in the list. Adjust freely (milliseconds).
export const FILES_REFETCH_DELAY_MS = 3000;
// Matches the sidebar status poller, so both chat lists settle a finished row at the same pace.
export const CHATS_STATUS_POLL_INTERVAL_MS = 5000;

export const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
