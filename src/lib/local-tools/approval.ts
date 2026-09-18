/**
 * Approval flow for local coding tools. agent-core answers an unlisted shell
 * command with `{code:'permission_required', grant:{kind,target,mode,why,nonce}}`
 * and expects the SAME call retried with `grant_nonce` (the nonce is single-use).
 * Instead of leaving the model to relay that conversationally, the desktop
 * intercepts it: an always-allowed grant retries silently, anything else asks
 * the user once through a native dialog.
 *
 * Dependency-free module store (cf. session-token.ts): the dialog subscribes via
 * useSyncExternalStore; tool executors await `requestApproval`.
 */

export type ApprovalDecision = 'allow-once' | 'allow-always' | 'deny';

export interface PermissionGrant {
    kind: string;
    target: string;
    mode: string;
    why?: string;
    nonce: string;
}

export interface PermissionPrompt {
    id: number;
    toolName: string;
    grant: PermissionGrant;
}

const STORAGE_KEY = 'fm_local_tool_always_allow';
/** An unanswered prompt must not hold the chat turn open forever. */
const DECISION_TIMEOUT_MS = 120_000;

// ---- "Always allow" list -------------------------------------------------

// Keyed on kind:mode:target — the nonce is per-attempt and must never be stored.
const allowKey = (grant: PermissionGrant): string => `${grant.kind}:${grant.mode}:${grant.target}`;

const readAllowlist = (): string[] => {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');

        return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
    } catch {
        return [];
    }
};

export const isAlwaysAllowed = (grant: PermissionGrant): boolean => readAllowlist().includes(allowKey(grant));

export const rememberAlwaysAllowed = (grant: PermissionGrant): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...readAllowlist(), allowKey(grant)])]));
    } catch {
        // Storage blocked — the grant simply stays one-time.
    }
};

// ---- Prompt store --------------------------------------------------------

interface PendingPrompt extends PermissionPrompt {
    settle: (decision: ApprovalDecision) => void;
}

let nextId = 1;
let current: PendingPrompt | null = null;
let queue: PendingPrompt[] = [];
const listeners = new Set<() => void>();

const emit = (): void => {
    listeners.forEach((listener) => listener());
};

export const subscribeToPrompt = (listener: () => void): (() => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

export const getCurrentPrompt = (): PermissionPrompt | null => current;

const advance = (): void => {
    current = queue.shift() ?? null;
    emit();
};

/** Called by the dialog. Advances to the queued prompt (if any) before settling. */
export const resolveCurrentPrompt = (decision: ApprovalDecision): void => {
    if (!current) {
        return;
    }

    const settled = current;

    advance();
    settled.settle(decision);
};

export const requestApproval = (toolName: string, grant: PermissionGrant): Promise<ApprovalDecision> =>
    new Promise((resolve) => {
        let done = false;
        let timer = 0;

        const prompt: PendingPrompt = {
            id: nextId++,
            toolName,
            grant,
            settle: (decision) => {
                if (done) {
                    return;
                }
                done = true;
                window.clearTimeout(timer);
                // A timeout can fire while this prompt is still displayed or queued;
                // in both cases it must leave the store, not just this promise.
                if (current?.id === prompt.id) {
                    advance();
                } else if (queue.some((entry) => entry.id === prompt.id)) {
                    queue = queue.filter((entry) => entry.id !== prompt.id);
                }
                resolve(decision);
            },
        };

        timer = window.setTimeout(() => prompt.settle('deny'), DECISION_TIMEOUT_MS);

        if (current) {
            queue.push(prompt);
        } else {
            current = prompt;
            emit();
        }
    });

/** Test hook: settles everything as denied and empties the store. */
export const resetApprovalStateForTests = (): void => {
    const pending = [current, ...queue].filter((entry): entry is PendingPrompt => entry !== null);

    current = null;
    queue = [];
    pending.forEach((entry) => entry.settle('deny'));
    emit();
};

// ---- Envelope detection --------------------------------------------------

const grantOf = (candidate: unknown): PermissionGrant | null => {
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }

    const { code, grant } = candidate as { code?: unknown; grant?: unknown };

    if (code !== 'permission_required' || !grant || typeof grant !== 'object') {
        return null;
    }

    const fields = grant as Record<string, unknown>;

    if (typeof fields.nonce !== 'string' || typeof fields.target !== 'string' || typeof fields.mode !== 'string') {
        return null;
    }

    return {
        kind: typeof fields.kind === 'string' ? fields.kind : 'command',
        target: fields.target,
        mode: fields.mode,
        why: typeof fields.why === 'string' ? fields.why : undefined,
        nonce: fields.nonce,
    };
};

/** Finds the verified agent-core grant envelope at the top level or under `.data`/`.error`. */
export const extractPermissionGrant = (result: unknown): PermissionGrant | null => {
    const container = result as { data?: unknown; error?: unknown } | null | undefined;

    return grantOf(result) ?? grantOf(container?.data) ?? grantOf(container?.error);
};
