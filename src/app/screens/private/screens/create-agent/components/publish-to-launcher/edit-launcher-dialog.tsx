import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLinkIcon, LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import ConfirmationModal from '@/components/ui/confirmation-modal';
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
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';

import { invalidateAgentTiles } from '../../../agents/hooks/use-agents-queries';
import {
    deleteLauncher,
    toLauncherCreateError,
    updateLauncher,
    validateLauncherFields,
    type AgentLauncher,
    type LauncherCreateError,
    type LauncherEdit,
} from '../../lib/launcher-publish';

import { launcherQueryKey } from './use-agent-launcher';

interface EditLauncherDialogProps {
    agentId: string;
    agentName: string;
    launcher: AgentLauncher;
    onClose: () => void;
}

const EditLauncherDialog = ({ agentId, agentName, launcher, onClose }: EditLauncherDialogProps) => {
    const queryClient = useQueryClient();

    // Frozen at mount. The diff below must compare against what the form was seeded from, never the
    // live prop: a refetch landing while the panel is open would make an untouched field look edited
    // and write the value the user is looking at back over the newer one.
    const [seed] = useState(launcher);

    const [name, setName] = useState(seed.name ?? '');
    const [description, setDescription] = useState(seed.description ?? '');
    const [slug, setSlug] = useState(seed.urlOrSlug ?? '');
    const [sortOrder, setSortOrder] = useState(String(seed.sortOrder ?? 0));
    const [isPublished, setIsPublished] = useState(seed.isPublished !== false);
    const [error, setError] = useState<LauncherCreateError | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const saveMutation = useMutation({
        mutationFn: (edit: LauncherEdit) => updateLauncher(seed._id, edit),
        onSuccess: async () => {
            await queryClient.refetchQueries({ queryKey: launcherQueryKey(agentId) });
            void invalidateAgentTiles(queryClient);
            onClose();
            toast.success('Launcher updated');
        },
        onError: (mutationError: unknown) =>
            setError(toLauncherCreateError(mutationError, 'Could not save this launcher. Please try again.')),
    });

    const deleteMutation = useMutation({
        mutationFn: () => deleteLauncher(seed._id),
        onSuccess: async () => {
            await queryClient.refetchQueries({ queryKey: launcherQueryKey(agentId) });
            void invalidateAgentTiles(queryClient);
            onClose();
            toast.success('Launcher deleted');
        },
        onError: (mutationError: unknown) => {
            setConfirmDelete(false);
            toast.error(getApiErrorMessage(mutationError, 'Could not delete this launcher. Please try again.'));
        },
    });

    const isBusy = saveMutation.isPending || deleteMutation.isPending;

    const handleSave = () => {
        const validated = validateLauncherFields({ name, urlOrSlug: slug, sortOrder });

        if (validated.error) {
            setError(validated.error);

            return;
        }

        // Only what actually changed. `PUT /launchers/:id` copies `urlOrSlug` onto the agent's own
        // slug, so resending an untouched one would revert a rename made since this form was seeded
        // — and every field sent is a field that overwrites a concurrent edit from /admin/launchers.
        const edit: LauncherEdit = {};

        if (validated.name !== seed.name) edit.name = validated.name;
        if (description.trim() !== (seed.description ?? '')) edit.description = description.trim();
        if (validated.urlOrSlug !== seed.urlOrSlug) edit.urlOrSlug = validated.urlOrSlug;
        if (validated.sortOrder !== undefined && validated.sortOrder !== seed.sortOrder) {
            edit.sortOrder = validated.sortOrder;
        }
        if (isPublished !== (seed.isPublished !== false)) edit.isPublished = isPublished;

        if (Object.keys(edit).length === 0) {
            onClose();

            return;
        }

        setError(null);
        saveMutation.mutate(edit);
    };

    const renderFieldError = (field: LauncherCreateError['field']) => {
        if (error?.field !== field) return null;

        return (
            <span id={`edit-launcher-${field}-error`} role="alert" className="text-xs text-destructive">
                {error.message}
            </span>
        );
    };

    const describedBy = (field: LauncherCreateError['field'], hintId?: string) =>
        [error?.field === field ? `edit-launcher-${field}-error` : null, hintId].filter(Boolean).join(' ') || undefined;

    const renderVisibility = () => (
        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex flex-col gap-0.5">
                <Label htmlFor="edit-launcher-published">Show on the home screen</Label>
                <span className="text-xs text-text-secondary">
                    Off keeps the launcher and everything in it — the tile just is not listed.
                </span>
            </div>
            <ToggleSwitch
                id="edit-launcher-published"
                checked={isPublished}
                onCheckedChange={setIsPublished}
                disabled={isBusy}
            />
        </div>
    );

    return (
        <>
            <Dialog open onOpenChange={(next) => !next && !isBusy && onClose()}>
                <DialogContent className="edit-launcher-dialog sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit launcher</DialogTitle>
                        <DialogDescription>
                            {seed.name} · created from {agentName}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody className="edit-launcher-fields flex flex-col gap-4">
                        {renderVisibility()}

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="edit-launcher-name">Name on the tile</Label>
                            <Input
                                id="edit-launcher-name"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                aria-invalid={error?.field === 'name'}
                                aria-describedby={describedBy('name', 'edit-launcher-name-hint')}
                            />
                            {renderFieldError('name')}
                            <span id="edit-launcher-name-hint" className="text-xs text-text-secondary">
                                Renaming the agent does not rename this.
                            </span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="edit-launcher-description">Description</Label>
                            <Input
                                id="edit-launcher-description"
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <div className="flex flex-1 flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <Label htmlFor="edit-launcher-slug">Link</Label>
                                    {/* Beside the field it belongs to rather than in the footer: this is the
                                        URL being edited, and the footer is for acting on the launcher. */}
                                    <Link
                                        to={`/agent/${agentId}`}
                                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                        Open launcher
                                        <ExternalLinkIcon className="size-3" aria-hidden="true" />
                                    </Link>
                                </div>
                                <Input
                                    id="edit-launcher-slug"
                                    value={slug}
                                    onChange={(event) => setSlug(event.target.value)}
                                    aria-invalid={error?.field === 'urlOrSlug'}
                                    aria-describedby={describedBy('urlOrSlug')}
                                />
                                {renderFieldError('urlOrSlug')}
                            </div>
                            <div className="flex w-28 flex-col gap-1.5">
                                <Label htmlFor="edit-launcher-sort-order">Sort order</Label>
                                <Input
                                    id="edit-launcher-sort-order"
                                    type="number"
                                    step={1}
                                    value={sortOrder}
                                    onChange={(event) => setSortOrder(event.target.value)}
                                    aria-invalid={error?.field === 'sortOrder'}
                                    aria-describedby={describedBy('sortOrder')}
                                />
                                {renderFieldError('sortOrder')}
                            </div>
                        </div>

                        {renderFieldError('form')}
                    </DialogBody>
                    {/* `DialogFooter` is already `justify-between`, so the destructive action takes the
                        left slot for free. A second action strip inside the body gave the panel two
                        footers with mismatched control heights. */}
                    <DialogFooter>
                        {/* The `destructive` variant is borderless by design, which left this reading
                            as bare text beside two boxed buttons. Boxed to match their weight. */}
                        <Button
                            type="button"
                            variant="destructive"
                            className="border border-destructive/40 bg-destructive/5"
                            disabled={isBusy}
                            onClick={() => setConfirmDelete(true)}
                        >
                            Delete launcher
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" disabled={isBusy} onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="button" disabled={isBusy} onClick={handleSave}>
                                {saveMutation.isPending ? (
                                    <LoaderCircleIcon className="size-3 animate-spin" aria-hidden="true" />
                                ) : null}
                                Save
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmationModal
                isOpen={confirmDelete}
                onClose={() => {
                    if (!deleteMutation.isPending) setConfirmDelete(false);
                }}
                onConfirm={() => deleteMutation.mutate()}
                title="Delete launcher"
                message="Removes the tile and its settings. The agent itself is untouched."
                confirmButtonText={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                cancelButtonText="Cancel"
                isButtonLoading={deleteMutation.isPending}
            />
        </>
    );
};

export default EditLauncherDialog;
