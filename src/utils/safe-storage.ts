export function safeLocalStorageGetItem(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function safeLocalStorageSetItem(key: string, value: string): boolean {
    try {
        localStorage.setItem(key, value);

        return true;
    } catch {
        return false;
    }
}

export function safeLocalStorageRemoveItem(key: string): boolean {
    try {
        localStorage.removeItem(key);

        return true;
    } catch {
        return false;
    }
}

export function safeSessionStorageGetItem(key: string): string | null {
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

export function safeSessionStorageSetItem(key: string, value: string): boolean {
    try {
        sessionStorage.setItem(key, value);

        return true;
    } catch {
        return false;
    }
}

export function safeSessionStorageRemoveItem(key: string): boolean {
    try {
        sessionStorage.removeItem(key);

        return true;
    } catch {
        return false;
    }
}

export function safeSessionStorageClear(): boolean {
    try {
        sessionStorage.clear();

        return true;
    } catch {
        return false;
    }
}
