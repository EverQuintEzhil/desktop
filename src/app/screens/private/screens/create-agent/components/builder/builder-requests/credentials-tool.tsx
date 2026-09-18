import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { CircleCheck, CircleSlash, ExternalLink, KeyRound, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { z } from 'zod';

import connectionFields from '@/admin/screens/private/screens/admin/components/data-stores/components/connectionFields.json';
import DataStoresConnection from '@/admin/screens/private/screens/admin/components/data-stores/components/data-stores-detail/components/data-stores-connection/data-stores-connection';
import { ChatBlock } from '@/components/chat/blocks';
import { ToolRailStep, useIsLastMessage } from '@/components/chat/tools';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataStoreByIdQuery } from '@/lib/api/admin/data-stores';
import { selectUser } from '@/store/selectors';

import { dataStoreHasEditableConnection } from '../data-store-edit/data-store-connection-modal';

import { useBuilderRequests } from './builder-requests-context';
import { builderRequestReceiptSchema, type BuilderRequestReceipt } from './types';
import WeblinksCard from './weblinks-card';

export const collectDataStoreCredentialsParameters = z.object({
    dataStoreId: z
        .string()
        .describe('The _id of an existing data store. Create the data store first if it does not exist yet.'),
    dataStoreName: z.string().optional().describe('The data store name, so the card reads naturally.'),
    reason: z.string().optional().describe('One short line telling the user why you need this.'),
});

export const collectDataStoreCredentialsDescription =
    'Show the user a connection form, inline in the chat, for an existing data store. ' +
    'ALWAYS use this instead of asking for a host, port, user, password, API key or connection string in the chat — ' +
    'secrets typed as a chat message are stored in the conversation and sent to the model, which this tool avoids. ' +
    'The form fields are derived from the data store provider, so create the store with the provider that matches ' +
    'the source (mongodb, postgresql, mysql, mssql, cassandra, elasticsearch, opensearch, s3, azure-blob-storage, ' +
    'sharepoint, api, weblinks). Only fall back to the custom provider when none of those fit — custom shows a raw ' +
    'JSON connection editor instead of proper fields. For a weblinks store the form collects the links to crawl or ' +
    'scrape rather than credentials. ' +
    'The data store must already exist; create it first, then call this with its _id. ' +
    'When the provider or engine is unknown, ask with ask_user as a choice list — never collect data store setup ' +
    'details through request_input. ' +
    'You get back confirmation that the connection was saved, never the values.';

const PRIVACY_NOTE =
    'Saved straight to the encrypted store. Nothing you type here enters the chat or reaches the model.';

const CollectDataStoreCredentialsTool = ({ args, result, addResult, toolCallId, status }: ToolCallMessagePartProps) => {
    const requests = useBuilderRequests();
    const user = useSelector(selectUser);
    const parsed = collectDataStoreCredentialsParameters.safeParse(args);
    const parsedReceipt = builderRequestReceiptSchema.safeParse(result);
    const [localReceipt, setLocalReceipt] = useState<BuilderRequestReceipt | null>(null);
    const settledRef = useRef(false);
    const mountedRef = useRef(true);
    // The name outlives the query: disabling it on settle drops `data`, and the model often omits
    // dataStoreName.
    const loadedNameRef = useRef<string | undefined>(undefined);
    const receipt = parsedReceipt.success ? parsedReceipt.data : localReceipt;
    // Args stream in token by token; dataStoreId can be a truncated value until the run pauses.
    const streaming = status.type === 'running' && !receipt;
    const isLastMessage = useIsLastMessage();
    // An answer submitted from an older message has no paused run to resume, so it would go
    // nowhere — render the card inert instead.
    const expired = !receipt && !streaming && !isLastMessage;

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    const dataStoreId = parsed.success ? parsed.data.dataStoreId : undefined;
    const {
        data: dataStore,
        isLoading,
        isError,
    } = useDataStoreByIdQuery(receipt || streaming || expired ? undefined : dataStoreId);

    if (dataStore) loadedNameRef.current = dataStore.name;

    if (!parsed.success || streaming) {
        return (
            <ToolRailStep tone="muted" icon={<KeyRound className="size-4" aria-hidden="true" />}>
                <ChatBlock bodyClassName="p-4 text-sm text-muted-foreground">Preparing…</ChatBlock>
            </ToolRailStep>
        );
    }

    const { dataStoreName, reason } = parsed.data;
    const title = `Connect ${dataStore?.name ?? loadedNameRef.current ?? dataStoreName ?? 'the data store'}`;

    if (expired) {
        return (
            <ToolRailStep tone="muted" icon={<KeyRound className="size-4" aria-hidden="true" />}>
                <ChatBlock bodyClassName="flex flex-col gap-1 p-4">
                    <span className="text-sm font-medium text-muted-foreground">{title}</span>
                    <span className="text-sm text-muted-foreground">
                        No longer active — the conversation has moved on.
                    </span>
                </ChatBlock>
            </ToolRailStep>
        );
    }

    // addResult throws "Entry not available in the store" if the tool call is already resolved or
    // the part has gone, so answering is guarded on both and the receipt only renders once the
    // result actually landed.
    const settle = (next: BuilderRequestReceipt) => {
        if (settledRef.current || !mountedRef.current) return;

        settledRef.current = true;

        try {
            addResult(next);
        } catch {
            settledRef.current = false;

            return;
        }

        setLocalReceipt(next);

        // Settling the card orphans any request it raised; without this, a later save through the
        // full editor resolves into a settled card and the result is lost.
        if (requests.pending?.id === toolCallId) {
            requests.cancel('The user answered in the chat instead.');
        }
    };

    if (receipt) {
        const done = receipt.status === 'completed';

        return (
            <ToolRailStep
                tone={done ? 'active' : 'muted'}
                icon={
                    done ? (
                        <CircleCheck className="size-4" aria-hidden="true" />
                    ) : (
                        <CircleSlash className="size-4" aria-hidden="true" />
                    )
                }
            >
                <ChatBlock bodyClassName="flex flex-col gap-1 p-4">
                    <span className="text-sm font-medium text-muted-foreground">{title}</span>
                    <span className="text-sm text-muted-foreground">{receipt.summary}</span>
                </ChatBlock>
            </ToolRailStep>
        );
    }

    const openFullEditor = () => {
        void requests.open({ id: toolCallId, kind: 'data-store-credentials', dataStoreId }).then((next) => {
            if (next.status === 'completed' || next.blocked) settle(next);
        });
    };

    const renderFullEditorButton = (label: string) => (
        <Button size="xs" variant="ghost" className="gap-1.5 self-start" onClick={openFullEditor}>
            <ExternalLink className="size-3.5" aria-hidden="true" />
            {label}
        </Button>
    );

    const renderBody = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-9 w-full rounded-md" />
                    <Skeleton className="h-9 w-full rounded-md" />
                    <Skeleton className="h-9 w-2/3 rounded-md" />
                </div>
            );
        }

        if (isError || !dataStore) {
            return (
                <div className="flex flex-col gap-2">
                    <span className="text-sm text-destructive">That data store could not be loaded.</span>
                    {renderFullEditorButton('Open data stores')}
                </div>
            );
        }

        const isCreator = !!dataStore.creator?._id && dataStore.creator._id === user._id;

        if (!isCreator) {
            return (
                <div className="flex flex-col gap-2">
                    <span className="text-sm text-muted-foreground">
                        Only the person who created this data store can edit its connection.
                    </span>
                    {renderFullEditorButton('Open data store')}
                </div>
            );
        }

        if (dataStore.provider === 'weblinks') {
            return (
                <>
                    <span className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                        {PRIVACY_NOTE}
                    </span>
                    <WeblinksCard
                        dataStore={dataStore}
                        onSaved={(linkCount) =>
                            settle({
                                status: 'completed',
                                summary:
                                    `The user saved ${linkCount} web link${linkCount === 1 ? '' : 's'} for "${dataStore.name}". ` +
                                    'Any credentials entered are stored encrypted and are not available to you.',
                                dataStoreId,
                            })
                        }
                        onSkip={() =>
                            settle({ status: 'cancelled', summary: 'The user chose to skip this step for now.' })
                        }
                    />
                    {renderFullEditorButton('Open full editor')}
                </>
            );
        }

        if (!dataStoreHasEditableConnection(dataStore.provider)) {
            return (
                <div className="flex flex-col gap-2">
                    <span className="text-sm text-muted-foreground">
                        This data store holds uploaded content, so it has no connection to fill in.
                    </span>
                    {renderFullEditorButton('Open data store')}
                </div>
            );
        }

        // A provider missing from connectionFields.json would otherwise render an empty form with
        // a lone Save button.
        const hasConnectionForm =
            ((connectionFields as Record<string, unknown[]>)[dataStore.provider] ?? []).length > 0;

        if (!hasConnectionForm) {
            return (
                <div className="flex flex-col gap-2">
                    <span className="text-sm text-muted-foreground">
                        This data store type has no inline connection form.
                    </span>
                    {renderFullEditorButton('Open data store')}
                </div>
            );
        }

        return (
            <>
                <span className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    {PRIVACY_NOTE}
                </span>
                <DataStoresConnection
                    dataStore={dataStore}
                    canUserEdit
                    showConnectionSecrets={false}
                    onSubmit={() =>
                        settle({
                            status: 'completed',
                            summary: `The user saved the connection for "${dataStore.name}". The credentials are stored encrypted and are not available to you.`,
                            dataStoreId,
                        })
                    }
                />
                <div className="flex items-center justify-between gap-2">
                    {renderFullEditorButton('Open full editor')}
                    <Button
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                            settle({ status: 'cancelled', summary: 'The user chose to skip this step for now.' })
                        }
                    >
                        Not now
                    </Button>
                </div>
            </>
        );
    };

    return (
        <ToolRailStep tone="muted" icon={<KeyRound className="size-4" aria-hidden="true" />}>
            <ChatBlock bodyClassName="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-foreground">{title}</span>
                    {reason ? <span className="text-sm text-muted-foreground">{reason}</span> : null}
                </div>
                {renderBody()}
            </ChatBlock>
        </ToolRailStep>
    );
};

export default CollectDataStoreCredentialsTool;
export { CollectDataStoreCredentialsTool };
