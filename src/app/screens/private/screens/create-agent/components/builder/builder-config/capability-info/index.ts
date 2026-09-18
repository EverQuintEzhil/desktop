import {
    BlocksIcon,
    BotIcon,
    BrainIcon,
    Cpu as CpuIcon,
    FileTextIcon,
    LinkIcon,
    PackageIcon,
    WrenchIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import agentsMd from './agents.md?raw';
import connectorsMd from './connectors.md?raw';
import dataStoresMd from './data-stores.md?raw';
import memoriesMd from './memories.md?raw';
import modelMd from './model.md?raw';
import skillsMd from './skills.md?raw';
import toolsMd from './tools.md?raw';

interface CapabilityInfo {
    description: string;
    detail: string;
    icon: LucideIcon;
}

// Each capability's copy lives in its own `## Description` / `## Detail` markdown file
// in this directory, so non-engineers can edit the wording without touching component code.
// The description is flattened to a single line (hover card); the detail keeps its
// markdown structure and is rendered with the Markdown component in the detail dialog.
const parseCapabilityMd = (raw: string): { description: string; detail: string } => {
    const sections = raw.split(/^##\s+/m).slice(1);
    const byHeader: Record<string, string> = {};

    for (const section of sections) {
        const [headerLine, ...rest] = section.split('\n');

        byHeader[headerLine.trim().toLowerCase()] = rest.join('\n').trim();
    }

    return {
        description: (byHeader.description ?? '').replace(/\s+/g, ' '),
        detail: byHeader.detail ?? '',
    };
};

const withIcon = (raw: string, icon: LucideIcon): CapabilityInfo => ({ ...parseCapabilityMd(raw), icon });

export const CAPABILITY_INFO: Record<string, CapabilityInfo> = {
    Connectors: withIcon(connectorsMd, BlocksIcon),
    Agents: withIcon(agentsMd, BotIcon),
    Tools: withIcon(toolsMd, WrenchIcon),
    Skills: withIcon(skillsMd, PackageIcon),
    'Files Stores': withIcon(dataStoresMd, FileTextIcon),
    'API Stores': withIcon(dataStoresMd, FileTextIcon),
    'DB Stores': withIcon(dataStoresMd, FileTextIcon),
    'Web Links Stores': withIcon(dataStoresMd, LinkIcon),
    Memories: withIcon(memoriesMd, BrainIcon),
    Model: withIcon(modelMd, CpuIcon),
};
