import { useState } from 'react';

import type { McpServer } from '@/lib/api';
import type { DataStoreProviderFilter } from '@/lib/api/admin/data-stores';

import type { AgentConfigDraft } from '../../../../types';
import type { PickerItemKind } from '../capability-picker-modal';
import type { ItemPendingRemoval, NamedItem } from '../types';

const FIELD_BY_KIND: Record<PickerItemKind, 'mcpServers' | 'tools' | 'agents' | 'memories'> = {
    mcp: 'mcpServers',
    tool: 'tools',
    agent: 'agents',
    memory: 'memories',
};

const FIELD_BY_REMOVABLE_TYPE: Record<
    'connector' | 'tool' | 'agent' | 'memory',
    'mcpServers' | 'tools' | 'agents' | 'memories'
> = {
    connector: 'mcpServers',
    tool: 'tools',
    agent: 'agents',
    memory: 'memories',
};

export const useBuilderConfigState = (config: AgentConfigDraft, onChange: (config: AgentConfigDraft) => void) => {
    const [capabilityPickerKind, setCapabilityPickerKind] = useState<PickerItemKind | null>(null);
    const [capabilityPickerInitialItem, setCapabilityPickerInitialItem] = useState<{
        _id: string;
        name: string;
    } | null>(null);
    const [capabilityPickerCreating, setCapabilityPickerCreating] = useState(false);
    const [skillsModalOpen, setSkillsModalOpen] = useState(false);
    const [skillModalInitialView, setSkillModalInitialView] = useState<string | null>(null);
    const [filesModalCategory, setFilesModalCategory] = useState<DataStoreProviderFilter | null>(null);
    const [fileModalInitialView, setFileModalInitialView] = useState<string | null>(null);
    const [itemPendingRemoval, setItemPendingRemoval] = useState<ItemPendingRemoval | null>(null);
    const [reconnectModalOpen, setReconnectModalOpen] = useState(false);
    const [reconnectServer, setReconnectServer] = useState<McpServer | null>(null);
    const [capabilityDetail, setCapabilityDetail] = useState<{ label: string; detail: string } | null>(null);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...config, name: e.target.value });
    };

    const handleInstructionsChange = (value: string) => {
        onChange({ ...config, instructions: value });
    };

    const handleToggleApp = (item: { _id: string; name: string }, kind: PickerItemKind) => {
        const field = FIELD_BY_KIND[kind];
        const current = config[field] ?? [];
        const exists = current.some((m) => m._id === item._id);

        onChange({
            ...config,
            [field]: exists ? current.filter((m) => m._id !== item._id) : [...current, item],
        });
    };

    const handleUpdateApp = (item: { _id: string; name: string; isRecommended?: boolean }, kind: PickerItemKind) => {
        const field = FIELD_BY_KIND[kind];
        const current = config[field] ?? [];

        onChange({
            ...config,
            [field]: current.map((m) => (m._id === item._id ? item : m)),
        });
    };

    const handleToggleSkill = (skill: { _id: string; name: string }) => {
        const current = config.skills ?? [];
        const exists = current.some((s) => s._id === skill._id);

        onChange({
            ...config,
            skills: exists ? current.filter((s) => s._id !== skill._id) : [...current, skill],
        });
    };

    const handleUpdateSkill = (skill: { _id: string; name: string; isRecommended?: boolean }) => {
        const current = config.skills ?? [];

        onChange({
            ...config,
            skills: current.map((s) => (s._id === skill._id ? skill : s)),
        });
    };

    const handleConfirmRemove = () => {
        if (!itemPendingRemoval) return;

        const { _id, type } = itemPendingRemoval;

        if (type === 'skill') {
            const current = config.skills ?? [];

            onChange({ ...config, skills: current.filter((s) => s._id !== _id) });
        } else if (type === 'data store') {
            const current = config.files ?? [];

            onChange({ ...config, files: current.filter((s) => s._id !== _id) });
        } else if (type === 'model') {
            const current = config.models ?? [];

            onChange({ ...config, models: current.filter((m) => m._id !== _id) });
        } else {
            const field = FIELD_BY_REMOVABLE_TYPE[type];
            const current = config[field] ?? [];

            onChange({ ...config, [field]: current.filter((m) => m._id !== _id) });
        }
        setItemPendingRemoval(null);
    };

    const handleToggleFile = (file: NamedItem) => {
        const current = config.files ?? [];
        const exists = current.some((item) => item._id === file._id);

        onChange({
            ...config,
            files: exists ? current.filter((item) => item._id !== file._id) : [...current, file],
        });
    };

    // A freshly created data store is attached, never toggled — the picker also navigates away to
    // the store's own screen, so a stray toggle-off here would be invisible until the next save.
    const handleAddFile = ({ _id, name, provider }: NamedItem) => {
        const current = config.files ?? [];

        if (current.some((item) => item._id === _id)) return;

        onChange({ ...config, files: [...current, { _id, name, provider }] });
    };

    const handleRequestRemoveFile = (file: NamedItem) => {
        setItemPendingRemoval({ ...file, type: 'data store' });
    };

    const handleCloseFilesModal = () => {
        setFilesModalCategory(null);
        setFileModalInitialView(null);
    };

    const openFilesModal = (category: DataStoreProviderFilter, initialViewId: string | null) => {
        setFileModalInitialView(initialViewId);
        setFilesModalCategory(category);
    };

    // Opens the rich capability-detail dialog (triggered from each row's icon tile).
    const openCapabilityDetail = (label: string, detail: string) => {
        setCapabilityDetail({ label, detail });
    };

    return {
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
        setFilesModalCategory,
        fileModalInitialView,
        setFileModalInitialView,
        itemPendingRemoval,
        setItemPendingRemoval,
        reconnectModalOpen,
        setReconnectModalOpen,
        reconnectServer,
        setReconnectServer,
        capabilityDetail,
        setCapabilityDetail,
        handleNameChange,
        handleInstructionsChange,
        handleToggleApp,
        handleUpdateApp,
        handleToggleSkill,
        handleUpdateSkill,
        handleConfirmRemove,
        handleToggleFile,
        handleAddFile,
        handleRequestRemoveFile,
        handleCloseFilesModal,
        openFilesModal,
        openCapabilityDetail,
    };
};
