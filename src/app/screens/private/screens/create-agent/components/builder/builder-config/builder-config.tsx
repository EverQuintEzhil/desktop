import { useSelector } from 'react-redux';

import { InstructionsEditor } from '@/components/instructions-editor';
import { useMcpConnectors } from '@/hooks';
import { cn } from '@/lib/utils';
import { selectTenant } from '@/store/selectors';

import type { AgentConfigDraft } from '../../../types';

import BuilderConfigModals from './components/builder-config-modals';
import CapabilitiesSection from './components/capabilities-section';
import ChannelsSection from './components/channels-section';
import SectionHeading from './components/section-heading';
import { useBuilderConfigState } from './hooks';
import { groupFilesByCategory } from './utils/group-files-by-category';

export interface BuilderConfigProps {
    config: AgentConfigDraft;
    agentId: string;
    onChange: (config: AgentConfigDraft) => void;
    onGenerateSkill: (description: string) => void;
    onViewSkill: (skillId: string) => void;
    onViewDataStore: (id: string) => void;
    onViewChannel: () => void;
    onOpenSettings: () => void;
}

const BuilderConfig = ({
    config,
    agentId,
    onChange,
    onGenerateSkill,
    onViewSkill,
    onViewDataStore,
    onViewChannel,
    onOpenSettings,
}: BuilderConfigProps) => {
    const hasMcpServers = (config.mcpServers?.length ?? 0) > 0;
    const { connectors } = useMcpConnectors({ enabled: hasMcpServers });
    const state = useBuilderConfigState(config, onChange);
    const tenant = useSelector(selectTenant);
    const filesByCategory = groupFilesByCategory(config.files);

    return (
        <div className={cn('builder-config flex-1 px-4 py-8')}>
            <div className="builder-config-content mx-auto flex max-w-[860px] flex-col gap-8">
                <div className="builder-config-content-header flex items-center">
                    <input
                        type="text"
                        className={cn(
                            'w-full border-0 bg-transparent text-[28px] leading-[1.15] font-semibold text-(--text-primary) outline-none',
                            'border-b-2 border-b-transparent pb-0.5 transition-[border-color] duration-140',
                            'placeholder:text-text-secondary focus:border-b-[color-mix(in_srgb,var(--primary)_72%,var(--border))]',
                        )}
                        placeholder="Agent name"
                        aria-label="Agent name"
                        value={config.name ?? ''}
                        onChange={state.handleNameChange}
                    />
                </div>

                <ChannelsSection tenantName={tenant?.name ?? 'Fluentmind'} onViewChannel={onViewChannel} />

                <CapabilitiesSection
                    config={config}
                    filesByCategory={filesByCategory}
                    state={state}
                    connectors={connectors}
                    onOpenSettings={onOpenSettings}
                    onViewSkill={onViewSkill}
                    onViewDataStore={onViewDataStore}
                />

                <div className="builder-config-content-instructions flex flex-col border-t border-border [&_.ca-instr-editor]:p-0!">
                    <SectionHeading
                        title="How it should behave"
                        technical="Instructions"
                        subtitle="This is the part you own — edit it like a memo to a new team member"
                    />
                    <div className="instructions-editor overflow-hidden rounded-3xl border border-border bg-card">
                        <div className="p-4 lg:p-6">
                            <InstructionsEditor
                                value={config.instructions ?? ''}
                                onChange={state.handleInstructionsChange}
                                placeholder="Give your agent instructions on how to operate."
                                attachments={{
                                    files: config.files,
                                    skills: config.skills,
                                    mcpServers: config.mcpServers,
                                    tools: config.tools,
                                    agents: config.agents,
                                }}
                            />
                        </div>
                    </div>
                </div>

                <BuilderConfigModals
                    agentId={agentId}
                    config={config}
                    filesByCategory={filesByCategory}
                    state={state}
                    connectors={connectors}
                    onGenerateSkill={onGenerateSkill}
                    onViewDataStore={onViewDataStore}
                />
            </div>
        </div>
    );
};

export default BuilderConfig;
