// Best-effort storage for the panel's layout and conversation keys: a blocked store must never take
// the assistant down with it. Session variants hold what should not outlive the tab.
export const readStored = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

export const writeStored = (key: string, value: string): void => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Ignored: see the note above.
    }
};

export const clearStored = (key: string): void => {
    try {
        localStorage.removeItem(key);
    } catch {
        // Ignored: see the note above.
    }
};

export const readSessionStored = (key: string): string | null => {
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
};

export const writeSessionStored = (key: string, value: string): void => {
    try {
        sessionStorage.setItem(key, value);
    } catch {
        // Ignored: see the note above.
    }
};
