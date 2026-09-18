import { XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMcpConnectors } from '@/hooks';
import type { DataStoreProviderFilter } from '@/lib/api/admin/data-stores';

import type { AgentConfigDraft } from '../../../../types';
import CapabilityDetail from '../capability-detail';
import { CAPABILITY_INFO } from '../capability-info';
import { CapabilityPickerModal } from '../capability-picker-modal';
import { ConnectorReconnectModal } from '../connector-reconnect-modal';
import { FilesPickerModal } from '../files-picker-modal';
import { useBuilderConfigState } from '../hooks';
import RemoveItemDialog from '../remove-item-dialog';
import { SkillsPickerModal } from '../skills-picker-modal';
import type { NamedItem } from '../types';

export interface BuilderConfigModalsProps {
    agentId: string;
    config: AgentConfigDraft;
    filesByCategory: Record<DataStoreProviderFilter, NamedItem[]>;
    state: ReturnType<typeof useBuilderConfigState>;
    connectors: ReturnType<typeof useMcpConnectors>['connectors'];
    onGenerateSkill: (description: string) => void;
    onViewDataStore: (id: string) => void;
}

const renderCapabilityDetailIcon = (label: string | undefined) => {
    if (!label) return null;

    const Icon = CAPABILITY_INFO[label]?.icon;

    if (!Icon) return null;

    return <Icon size={20} className="text-primary" aria-hidden="true" />;
};

const BuilderConfigModals = ({
    agentId,
    config,
    filesByCategory,
    state,
    connectors,
    onGenerateSkill,
    onViewDataStore,
}: BuilderConfigModalsProps) => {
    const {
        capabilityPickerKind,
        setCapabilityPickerKind,
        capabilityPickerInitialItem,
        setCapabilityPickerInitialItem,
        capabilityPickerCreating,
        setCapabilityPickerCreating,
        skillsModalOpen,
        setSkillsModalOpen,
        skillModalInitialView,
        setSkillModalInitialView,
        filesModalCategory,
        fileModalInitialView,
        itemPendingRemoval,
        setItemPendingRemoval,
        reconnectModalOpen,
        setReconnectModalOpen,
        reconnectServer,
        capabilityDetail,
        setCapabilityDetail,
        handleToggleApp,
        handleUpdateApp,
        handleToggleSkill,
        handleUpdateSkill,
        handleToggleFile,
        handleAddFile,
        handleConfirmRemove,
        handleCloseFilesModal,
    } = state;

    const selectedByKind = {
        mcp: config.mcpServers ?? [],
        agent: config.agents ?? [],
        tool: config.tools ?? [],
        memory: config.memories ?? [],
    };
    const selectedCapabilityIdsByKind = capabilityPickerKind ? selectedByKind[capabilityPickerKind] : [];

    return (
        <>
            <CapabilityPickerModal
                open={capabilityPickerKind !== null}
                agentId={agentId}
                kind={capabilityPickerKind ?? undefined}
                initialItemId={capabilityPickerInitialItem?._id}
                initialItemName={capabilityPickerInitialItem?.name}
                initialCreating={capabilityPickerCreating}
                selectedIds={new Set(selectedCapabilityIdsByKind.map((item) => item._id))}
                selectedItems={selectedCapabilityIdsByKind}
                onToggle={handleToggleApp}
                onUpdate={handleUpdateApp}
                onClose={() => {
                    setCapabilityPickerKind(null);
                    setCapabilityPickerInitialItem(null);
                    setCapabilityPickerCreating(false);
                }}
            />

            <SkillsPickerModal
                open={skillsModalOpen}
                selectedSkills={config.skills ?? []}
                onToggle={handleToggleSkill}
                onUpdate={handleUpdateSkill}
                onGenerateSkill={onGenerateSkill}
                initialViewSkillId={skillModalInitialView}
                onClose={() => {
                    setSkillsModalOpen(false);
                    setSkillModalInitialView(null);
                }}
            />

            <FilesPickerModal
                open={filesModalCategory !== null}
                providerFilter={filesModalCategory ?? 'blob-storage'}
                selectedFiles={filesByCategory[filesModalCategory ?? 'blob-storage']}
                onToggle={handleToggleFile}
                initialViewDataStoreId={fileModalInitialView}
                onCreated={(dataStore) => {
                    handleAddFile(dataStore);
                    handleCloseFilesModal();
                    onViewDataStore(dataStore._id);
                }}
                onClose={handleCloseFilesModal}
            />

            <Dialog
                open={capabilityDetail !== null}
                onOpenChange={(open) => {
                    if (!open) setCapabilityDetail(null);
                }}
            >
                <DialogContent className="gap-0 p-0 sm:max-w-xl">
                    <DialogHeader className="flex-row items-center gap-3 pr-2">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]">
                            {renderCapabilityDetailIcon(capabilityDetail?.label)}
                        </span>
                        <DialogTitle className="flex-1">{capabilityDetail?.label}</DialogTitle>
                        <DialogClose asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0 text-text-secondary"
                                aria-label="Close"
                            >
                                <XIcon size={17} aria-hidden="true" />
                            </Button>
                        </DialogClose>
                    </DialogHeader>
                    <DialogBody className="py-5">
                        {capabilityDetail ? <CapabilityDetail detail={capabilityDetail.detail} /> : null}
                    </DialogBody>
                </DialogContent>
            </Dialog>

            <ConnectorReconnectModal
                isOpen={reconnectModalOpen}
                onClose={() => setReconnectModalOpen(false)}
                server={reconnectServer}
                status={connectors.find((c) => c.server._id === reconnectServer?._id)?.status}
                onAddConnector={() => {
                    setReconnectModalOpen(false);
                    setCapabilityPickerInitialItem(null);
                    setCapabilityPickerCreating(true);
                    setCapabilityPickerKind('mcp');
                }}
            />

            <RemoveItemDialog
                open={!!itemPendingRemoval}
                itemName={itemPendingRemoval?.name}
                itemType={itemPendingRemoval?.type}
                onCancel={() => setItemPendingRemoval(null)}
                onConfirm={() => {
                    if (itemPendingRemoval) handleConfirmRemove();
                }}
            />
        </>
    );
};

export default BuilderConfigModals;
