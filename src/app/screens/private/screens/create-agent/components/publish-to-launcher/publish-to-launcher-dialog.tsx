import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { invalidateAgentTiles } from '../../../agents/hooks/use-agents-queries';
import {
    createLauncherForAgent,
    toLauncherCreateError,
    toLauncherSlug,
    validateLauncherFields,
    type AgentLauncher,
    type AgentLauncherState,
    type LauncherCreateError,
} from '../../lib/launcher-publish';

import { launcherQueryKey } from './use-agent-launcher';

interface PublishToLauncherDialogProps {
    agentId: string;
    agentName: string;
    agentDescription?: string;
    onClose: () => void;
    /** Read at submit time: the builder saves the description without touching this query's cache. */
    getAgentDescription?: () => string;
}

/**
 * Mounted only while open, so the fields seed from the agent as it is named right now. The builder
 * renames without refetching the launcher query, which is why the live prop wins over the cache.
 */
const PublishToLauncherDialog = ({
    agentId,
    agentName,
    agentDescription,
    onClose,
    getAgentDescription,
}: PublishToLauncherDialogProps) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const seededName = agentName.trim();

    const [name, setName] = useState(seededName);
    const [slug, setSlug] = useState(() => toLauncherSlug(seededName));
    const [sortOrder, setSortOrder] = useState('0');
    const [error, setError] = useState<LauncherCreateError | null>(null);

    const publishMutation = useMutation({
        mutationFn: (input: { name: string; urlOrSlug: string; sortOrder?: number }) =>
            createLauncherForAgent({
                agentId,
                name: input.name,
                urlOrSlug: input.urlOrSlug,
                description: getAgentDescription?.() ?? agentDescription,
                sortOrder: input.sortOrder,
            }),
        // `POST /launchers` answers with `value: null` when its post-transaction read misses, so the
        // launcher is created but not described — refetch rather than read fields off nothing.
        onSuccess: async (launcher: AgentLauncher | null) => {
            if (launcher) {
                queryClient.setQueryData<AgentLauncherState>(launcherQueryKey(agentId), (previous) =>
                    previous ? { ...previous, launcher } : previous,
                );
            }

            let landed = Boolean(launcher);

            if (!launcher) {
                // Awaited, not fired and forgotten: closing first would leave the control on the
                // cached `launcher: null` and offering to publish a second time, which can only 400.
                await queryClient.refetchQueries({ queryKey: launcherQueryKey(agentId) });
                landed = Boolean(queryClient.getQueryData<AgentLauncherState>(launcherQueryKey(agentId))?.launcher);
            }

            // The new launcher is a home tile, and publishing also rewrites the agent's own slug —
            // every grid that can render either has to be re-read.
            void invalidateAgentTiles(queryClient);
            onClose();

            // The launcher is created either way. Only the reader may not have caught up, and saying
            // so is better than a plain success under a control still offering to publish.
            const notLanded = landed ? 'Published to a launcher' : 'Published. Reload to see it here.';
            const message = launcher ? `Published to ${launcher.name}` : notLanded;

            toast.success(message, {
                action: { label: 'View', onClick: () => navigate(`/agent/${agentId}`) },
            });
        },
        onError: (mutationError: unknown) => {
            const nextError = toLauncherCreateError(mutationError, 'Could not publish this agent. Please try again.');

            // The launcher exists after all — refetching swaps the menu to its published state
            // rather than leaving an offer that can only ever 400 again.
            if (nextError.alreadyPublished) {
                void queryClient.invalidateQueries({ queryKey: launcherQueryKey(agentId) });
            }

            setError(nextError);
        },
    });

    const handleSubmit = () => {
        const validated = validateLauncherFields({ name, urlOrSlug: slug, sortOrder });

        if (validated.error) {
            setError(validated.error);

            return;
        }

        setError(null);
        publishMutation.mutate({
            name: validated.name,
            urlOrSlug: validated.urlOrSlug,
            sortOrder: validated.sortOrder,
        });
    };

    const renderFieldError = (field: LauncherCreateError['field']) => {
        if (error?.field !== field) return null;

        return (
            <span id={`publish-to-launcher-${field}-error`} role="alert" className="text-xs text-destructive">
                {error.message}
            </span>
        );
    };

    return (
        // Not dismissable mid-create: the POST is already gone, so closing here would leave a
        // launcher created behind the user's back with the menu still offering to publish.
        <Dialog open onOpenChange={(next) => !next && !publishMutation.isPending && onClose()}>
            <DialogContent className="publish-to-launcher-dialog sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Publish to launcher</DialogTitle>
                    <DialogDescription>
                        A launcher puts this agent on the home screen for everyone already on its user list.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody className="publish-to-launcher-fields flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="publish-to-launcher-name">Launcher name</Label>
                        <Input
                            id="publish-to-launcher-name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            aria-invalid={error?.field === 'name'}
                            aria-describedby={error?.field === 'name' ? 'publish-to-launcher-name-error' : undefined}
                        />
                        {renderFieldError('name')}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="publish-to-launcher-slug">URL</Label>
                        <Input
                            id="publish-to-launcher-slug"
                            value={slug}
                            onChange={(event) => setSlug(event.target.value)}
                            aria-invalid={error?.field === 'urlOrSlug'}
                            aria-describedby={
                                error?.field === 'urlOrSlug'
                                    ? 'publish-to-launcher-urlOrSlug-error publish-to-launcher-slug-hint'
                                    : 'publish-to-launcher-slug-hint'
                            }
                        />
                        {renderFieldError('urlOrSlug')}
                        <span id="publish-to-launcher-slug-hint" className="text-xs text-text-secondary">
                            Renaming the agent later rewrites this URL.
                        </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="publish-to-launcher-sort-order">Sort order</Label>
                        <Input
                            id="publish-to-launcher-sort-order"
                            type="number"
                            step={1}
                            value={sortOrder}
                            onChange={(event) => setSortOrder(event.target.value)}
                            aria-invalid={error?.field === 'sortOrder'}
                            aria-describedby={
                                error?.field === 'sortOrder'
                                    ? 'publish-to-launcher-sortOrder-error publish-to-launcher-sort-order-hint'
                                    : 'publish-to-launcher-sort-order-hint'
                            }
                        />
                        {renderFieldError('sortOrder')}
                        <span id="publish-to-launcher-sort-order-hint" className="text-xs text-text-secondary">
                            Where it sits among the home tiles. Lower numbers come first.
                        </span>
                    </div>
                    {renderFieldError('form')}
                </DialogBody>
                <DialogFooter>
                    <Button type="button" variant="outline" disabled={publishMutation.isPending} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="button" disabled={publishMutation.isPending} onClick={handleSubmit}>
                        {publishMutation.isPending ? (
                            <LoaderCircleIcon className="size-3 animate-spin" aria-hidden="true" />
                        ) : null}
                        Publish
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PublishToLauncherDialog;
