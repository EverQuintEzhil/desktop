import { useCallback, useRef, useState } from 'react';

import { adminCodeManagerApi } from '@/lib/api/admin/code-manager';

import { bumpVersion, INITIAL_VERSION } from '../lib/create-agent-api';

export interface CodeDraftSeed<T> {
    publishedCodeId?: string;
    publishedVersion?: string;
    publishedValue?: T;
    pendingCodeId?: string;
    pendingVersion?: string;
    pendingValue?: T;
}

export interface CodeDraftStatus {
    onSaving?: () => void;
    onSaved?: () => void;
    onError?: (error: unknown, label: string) => void;
}

export interface UseCodeDraftOptions<T> {
    agentId: string;
    codeType: string;
    lang: string;
    pointerField: string;
    label: string;
    serialize: (value: T) => string;
    allowBootstrap?: boolean;
    status?: CodeDraftStatus;
    onLocalSaved?: (value: T) => void;
}

export interface CodeDraftApi<T> {
    hasPending: boolean;
    isDirty: () => boolean;
    getCurrent: () => T | undefined;
    resetCurrent: (value: T | undefined) => void;
    getPublished: () => T | undefined;
    save: (next: T) => Promise<boolean>;
    publish: () => Promise<boolean>;
    discard: () => Promise<T | undefined>;
    reseed: (seed: CodeDraftSeed<T>) => void;
}

export const useCodeDraft = <T>(options: UseCodeDraftOptions<T>, seed: CodeDraftSeed<T>): CodeDraftApi<T> => {
    const optionsRef = useRef(options);

    optionsRef.current = options;

    // Pinned, unlike the rest of the options: a draft belongs to the agent it was created for, and
    // writes here can run long after they were scheduled (the autosave flush fires on unmount).
    // Resolving this from `optionsRef` would stamp the code with whichever agent is mounted then.
    const agentIdRef = useRef(options.agentId);

    const publishedCodeIdRef = useRef<string | undefined>(seed.publishedCodeId);
    const publishedVersionRef = useRef<string | undefined>(seed.publishedVersion);
    const publishedValueRef = useRef<T | undefined>(seed.publishedValue);
    const pendingCodeIdRef = useRef<string | undefined>(seed.pendingCodeId);
    const pendingVersionRef = useRef<string | undefined>(seed.pendingVersion);
    const currentValueRef = useRef<T | undefined>(seed.pendingValue ?? seed.publishedValue);
    const savingRef = useRef(false);
    const savePromiseRef = useRef<Promise<boolean> | null>(null);
    const saveRef = useRef<((next: T) => Promise<boolean>) | null>(null);
    const opPromiseRef = useRef<Promise<unknown> | null>(null);

    const [hasPending, setHasPending] = useState(!!seed.pendingCodeId);

    const isDirty = useCallback(() => savingRef.current || currentValueRef.current !== publishedValueRef.current, []);

    const getCurrent = useCallback(() => currentValueRef.current, []);

    const resetCurrent = useCallback((value: T | undefined) => {
        currentValueRef.current = value;
    }, []);

    const getPublished = useCallback(() => publishedValueRef.current, []);

    const save = useCallback((next: T): Promise<boolean> => {
        currentValueRef.current = next;

        if (savingRef.current) {
            return savePromiseRef.current ?? Promise.resolve(false);
        }

        savingRef.current = true;

        const run = (async (): Promise<boolean> => {
            const { codeType, lang, pointerField, label, serialize, allowBootstrap, status, onLocalSaved } =
                optionsRef.current;
            const agentId = agentIdRef.current;

            status?.onSaving?.();

            try {
                let keepGoing = true;

                while (keepGoing) {
                    const value = currentValueRef.current as T;
                    const shouldBootstrap =
                        !!allowBootstrap && !publishedCodeIdRef.current && !pendingCodeIdRef.current;

                    if (shouldBootstrap) {
                        const created = await adminCodeManagerApi.createCode({
                            code: serialize(value),
                            type: codeType,
                            lang,
                            version: INITIAL_VERSION,
                            agentId,
                        });

                        await adminCodeManagerApi.updateEntity('agents', agentId, { [pointerField]: created._id });
                        publishedCodeIdRef.current = created._id;
                        publishedVersionRef.current = created.version ?? INITIAL_VERSION;
                        publishedValueRef.current = value;
                    } else if (pendingCodeIdRef.current) {
                        const updated = await adminCodeManagerApi.updateCode(pendingCodeIdRef.current, {
                            code: serialize(value),
                        });

                        pendingCodeIdRef.current = updated._id ?? pendingCodeIdRef.current;
                        pendingVersionRef.current = updated.version ?? pendingVersionRef.current;
                        setHasPending(true);
                    } else {
                        const created = await adminCodeManagerApi.createCode({
                            code: serialize(value),
                            type: codeType,
                            lang,
                            version: bumpVersion(publishedVersionRef.current),
                            agentId,
                        });

                        pendingCodeIdRef.current = created._id;
                        pendingVersionRef.current = created.version ?? INITIAL_VERSION;
                        setHasPending(true);
                    }

                    keepGoing = currentValueRef.current !== value;
                }

                onLocalSaved?.(currentValueRef.current as T);
                status?.onSaved?.();

                return true;
            } catch (error) {
                status?.onError?.(error, label);

                return false;
            } finally {
                savingRef.current = false;
                savePromiseRef.current = null;
            }
        })();

        savePromiseRef.current = run;

        return run;
    }, []);

    saveRef.current = save;

    const publish = useCallback(async (): Promise<boolean> => {
        while (savePromiseRef.current || opPromiseRef.current) {
            await (savePromiseRef.current ?? opPromiseRef.current ?? Promise.resolve()).catch(() => {});
        }

        if (!pendingCodeIdRef.current) {
            return false;
        }

        savingRef.current = true;
        const snapshot = currentValueRef.current;

        const run = (async (): Promise<boolean> => {
            try {
                const { pointerField } = optionsRef.current;
                const agentId = agentIdRef.current;
                const draftId = pendingCodeIdRef.current as string;

                await adminCodeManagerApi.updateEntity('agents', agentId, { [pointerField]: draftId });
                publishedCodeIdRef.current = draftId;
                publishedVersionRef.current = pendingVersionRef.current;
                publishedValueRef.current = snapshot;
                pendingCodeIdRef.current = undefined;
                pendingVersionRef.current = undefined;
                setHasPending(false);

                return true;
            } finally {
                savingRef.current = false;
                opPromiseRef.current = null;
            }
        })();

        opPromiseRef.current = run;

        const result = await run;

        if (currentValueRef.current !== snapshot && saveRef.current) {
            void saveRef.current(currentValueRef.current as T);
        }

        return result;
    }, []);

    const discard = useCallback(async (): Promise<T | undefined> => {
        while (savePromiseRef.current || opPromiseRef.current) {
            await (savePromiseRef.current ?? opPromiseRef.current ?? Promise.resolve()).catch(() => {});
        }

        savingRef.current = true;

        const run = (async (): Promise<T | undefined> => {
            try {
                const draftId = pendingCodeIdRef.current;

                currentValueRef.current = publishedValueRef.current;
                pendingCodeIdRef.current = undefined;
                pendingVersionRef.current = undefined;
                setHasPending(false);
                if (draftId) {
                    await adminCodeManagerApi.deleteCode(draftId).catch(() => {});
                }

                return publishedValueRef.current;
            } finally {
                savingRef.current = false;
                opPromiseRef.current = null;
            }
        })();

        opPromiseRef.current = run;

        return run;
    }, []);

    const reseed = useCallback((nextSeed: CodeDraftSeed<T>) => {
        publishedCodeIdRef.current = nextSeed.publishedCodeId;
        publishedVersionRef.current = nextSeed.publishedVersion;
        publishedValueRef.current = nextSeed.publishedValue;
        pendingCodeIdRef.current = nextSeed.pendingCodeId;
        pendingVersionRef.current = nextSeed.pendingVersion;
        currentValueRef.current = nextSeed.pendingValue ?? nextSeed.publishedValue;
        setHasPending(!!nextSeed.pendingCodeId);
    }, []);

    return {
        hasPending,
        isDirty,
        getCurrent,
        resetCurrent,
        getPublished,
        save,
        publish,
        discard,
        reseed,
    };
};
