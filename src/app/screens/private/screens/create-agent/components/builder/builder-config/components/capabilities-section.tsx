import {
    BotIcon,
    BrainIcon,
    CpuIcon,
    DatabaseIcon,
    FileTextIcon,
    GraduationCapIcon,
    LinkIcon,
    PlugIcon,
    WrenchIcon,
    ZapIcon,
} from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useMcpConnectors } from '@/hooks';
import type { DataStoreProviderFilter } from '@/lib/api/admin/data-stores';

import type { AgentConfigDraft, AgentConfigItem } from '../../../../types';
import { CAPABILITY_INFO } from '../capability-info';
import type { PickerItemKind } from '../capability-picker-modal';
import { useBuilderConfigState } from '../hooks';
import type { CapabilityRow, NamedItem } from '../types';

import CapabilityRowItem from './capability-row-item';
import FileChip from './file-chip';
import ItemPill, { type ItemPillKind } from './item-pill';
import SectionHeading from './section-heading';
import SkillChip from './skill-chip';

export interface CapabilitiesSectionProps {
    config: AgentConfigDraft;
    filesByCategory: Record<DataStoreProviderFilter, NamedItem[]>;
    state: ReturnType<typeof useBuilderConfigState>;
    connectors: ReturnType<typeof useMcpConnectors>['connectors'];
    onOpenSettings: () => void;
    onViewSkill: (skillId: string) => void;
    onViewDataStore: (id: string) => void;
}

const modelName = (item: AgentConfigItem): string => (item.name && item.name !== item._id ? item.name : item._id);

const CapabilitiesSection = ({
    config,
    filesByCategory,
    state,
    connectors,
    onOpenSettings,
    onViewSkill,
    onViewDataStore,
}: CapabilitiesSectionProps) => {
    const {
        setCapabilityPickerKind,
        setCapabilityPickerInitialItem,
        setSkillModalInitialView,
        setSkillsModalOpen,
        openFilesModal,
        setItemPendingRemoval,
        setReconnectServer,
        setReconnectModalOpen,
        openCapabilityDetail,
        handleRequestRemoveFile,
    } = state;

    const models = config.models ?? [];

    const openDetail = (label: string) => {
        const info = CAPABILITY_INFO[label];

        if (info) openCapabilityDetail(label, info.detail);
    };

    const openCapabilityPicker = (kind: PickerItemKind, initialItem: NamedItem | null = null) => {
        setCapabilityPickerInitialItem(initialItem);
        setCapabilityPickerKind(kind);
    };

    const handleReconnect = (item: NamedItem) => {
        const connector = connectors.find((c) => c.server._id === item._id);

        if (connector) {
            setReconnectServer(connector.server);
            setReconnectModalOpen(true);
        }
    };

    const renderItemPills = (items: NamedItem[] | undefined, kind: Exclude<ItemPillKind, 'model'>) => {
        if (!items?.length) return null;

        const pickerKind: PickerItemKind = kind === 'connector' ? 'mcp' : kind;

        return items.map((item) => {
            const connectorStatus = kind === 'connector' && connectors.find((c) => c.server._id === item._id)?.status;
            const isExpired = Boolean(
                connectorStatus &&
                (connectorStatus === 'expired' || connectorStatus === 'not_connected' || connectorStatus === 'pending'),
            );

            return (
                <ItemPill
                    key={item._id}
                    item={item}
                    kind={kind}
                    isExpired={isExpired}
                    onRemove={() => setItemPendingRemoval({ ...item, type: kind })}
                    onViewDetail={() => openCapabilityPicker(pickerKind, item)}
                    onReconnect={() => handleReconnect(item)}
                />
            );
        });
    };

    const renderSkillPills = () => {
        if (!config.skills?.length) return null;

        return config.skills.map((skill) => (
            <SkillChip
                key={skill._id}
                skill={skill}
                onRemove={() => setItemPendingRemoval({ ...skill, type: 'skill' })}
                onViewSkill={onViewSkill}
            />
        ));
    };

    const renderFileChips = (files: NamedItem[]) =>
        files.map((file) => (
            <FileChip key={file._id} file={file} onRemove={handleRequestRemoveFile} onViewDataStore={onViewDataStore} />
        ));

    const renderModelPills = () => {
        if (!models.length) return null;

        return models.map((item, index) => (
            <ItemPill
                key={item._id}
                item={{ ...item, name: modelName(item) }}
                kind="model"
                onRemove={models.length > 1 ? () => setItemPendingRemoval({ ...item, type: 'model' }) : undefined}
                onViewDetail={onOpenSettings}
                badge={index === 0 ? <span className="text-xs text-text-secondary">Default</span> : undefined}
            />
        ));
    };

    const primaryRows: CapabilityRow[] = [
        {
            technical: 'Model',
            title: 'AI model',
            Icon: CpuIcon,
            help: 'The AI engine that powers it',
            chips: renderModelPills(),
            onAdd: onOpenSettings,
            addLabel: 'Add model',
        },
        {
            technical: 'Skills',
            title: 'How-to guides it follows',
            Icon: GraduationCapIcon,
            help: 'Step-by-step playbooks for common tasks',
            chips: renderSkillPills(),
            onAdd: () => {
                setSkillModalInitialView(null);
                setSkillsModalOpen(true);
            },
            addLabel: 'Add skill',
        },
        {
            technical: 'Files',
            title: 'Documents it can read',
            Icon: FileTextIcon,
            help: 'Uploaded files it can reference, like standards or fee guides',
            chips: renderFileChips(filesByCategory['blob-storage']),
            onAdd: () => openFilesModal('blob-storage', null),
            addLabel: 'Add files store',
        },
        {
            technical: 'Websites',
            title: 'Web pages it can read',
            Icon: LinkIcon,
            help: 'Websites it crawls and keeps up to date, like public guidelines',
            chips: renderFileChips(filesByCategory.weblinks),
            onAdd: () => openFilesModal('weblinks', null),
            addLabel: 'Add web link store',
        },
        {
            technical: 'Connectors',
            title: 'Apps it connects to',
            Icon: PlugIcon,
            help: 'Outside services like email, Microsoft 365, or the web',
            chips: renderItemPills(config.mcpServers, 'connector'),
            onAdd: () => openCapabilityPicker('mcp'),
            addLabel: 'Add connector',
        },
    ];

    const advancedRows: CapabilityRow[] = [
        {
            technical: 'Tools',
            title: 'What it can do',
            Icon: WrenchIcon,
            help: 'The actions it can take — looking things up, saving records, building dashboards',
            chips: renderItemPills(config.tools, 'tool'),
            onAdd: () => openCapabilityPicker('tool'),
            addLabel: 'Add tool',
        },
        {
            technical: 'Databases',
            title: 'Information it can search',
            Icon: DatabaseIcon,
            help: 'The databases it pulls answers from',
            chips: renderFileChips(filesByCategory.db),
            onAdd: () => openFilesModal('db', null),
            addLabel: 'Add DB store',
        },
        {
            technical: 'APIs',
            title: 'Live data it can fetch',
            Icon: ZapIcon,
            help: 'Outside data feeds it can pull from on demand',
            chips: renderFileChips(filesByCategory.api),
            onAdd: () => openFilesModal('api', null),
            addLabel: 'Add API store',
        },
        {
            technical: 'Agents',
            title: 'Other assistants it can ask',
            Icon: BotIcon,
            help: 'Specialist assistants it can hand questions to',
            chips: renderItemPills(config.agents, 'agent'),
            onAdd: () => openCapabilityPicker('agent'),
            addLabel: 'Add agent',
        },
        {
            technical: 'Memories',
            title: 'What it remembers',
            Icon: BrainIcon,
            help: 'Notes it keeps between conversations, like your firm and preferences',
            chips: renderItemPills(config.memories, 'memory'),
            onAdd: () => openCapabilityPicker('memory'),
            addLabel: 'Add memory',
        },
    ];

    return (
        <div className="builder-config-content-capabilities flex flex-col border-t border-border">
            <SectionHeading
                title="What it works with"
                subtitle="The data, apps, and abilities this assistant can use"
            />
            <div className="builder-config-content-mcp rounded-3xl border border-border bg-card px-4 py-2 lg:px-6">
                {primaryRows.map((row) => (
                    <CapabilityRowItem key={row.technical} row={row} onOpenDetail={openDetail} />
                ))}
                <Accordion type="single" collapsible>
                    <AccordionItem value="advanced" className="border-b-0">
                        <AccordionTrigger className="py-[18px] text-sm font-semibold no-underline hover:no-underline">
                            Advanced
                        </AccordionTrigger>
                        <AccordionContent>
                            {advancedRows.map((row) => (
                                <CapabilityRowItem key={row.technical} row={row} onOpenDetail={openDetail} />
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
};

export default CapabilitiesSection;
