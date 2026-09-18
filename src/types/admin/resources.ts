import type { AgentType } from './agents';
import type { AppType } from './apps';
import type { BlogPostRelatedType, BlogPostType } from './blog';
import type { DataStoreType } from './data-stores';
import type { LauncherType } from './launchers';
import type { McpType } from './mcp';
import type { MemoryType } from './memory';
import { modelDisplayName, type ModelType } from './models';
import type { PromptType } from './prompts';
import type { SkillType } from './skills';
import type { ToolType } from './tools';

export type ResourceType =
    | AgentType
    | LauncherType
    | ModelType
    | McpType
    | ToolType
    | SkillType
    | DataStoreType
    | CapabilitiesType
    | PromptType
    | BlogPostType
    | AppType
    | MemoryType;

export type ResourceApiType =
    | 'agents'
    | 'launchers'
    | 'models'
    | 'mcpservers'
    | 'tools'
    | 'skills'
    | 'datastores'
    | 'capabilities'
    | 'prompts'
    | 'blogposts'
    | 'apps'
    | 'memories';

export type CapabilitiesType =
    | 'blogposts'
    | 'tools'
    | 'datastores'
    | 'mcpservers'
    | 'models'
    | 'agents'
    | 'prompts'
    | 'tags'
    | 'skills'
    | 'apps'
    | 'memories';

export type CapabilitiesData =
    | BlogPostRelatedType[]
    | ToolType[]
    | DataStoreType[]
    | McpType[]
    | ModelType[]
    | AgentType[]
    | PromptType[]
    | MemoryType[]
    | { _id: string; name: string }[];

/** One row in a capabilities tag list (tools, data stores, Connectors, models, or linked agents). */
export type CapabilityListEntry =
    | BlogPostRelatedType
    | ToolType
    | DataStoreType
    | McpType
    | ModelType
    | AgentType
    | PromptType
    | MemoryType
    | { _id: string; name: string };

export function capabilityListDisplayLabel(entry: CapabilityListEntry, capabilitiesType: CapabilitiesType): string {
    if (typeof entry !== 'object' || entry === null) {
        return '';
    }

    if (capabilitiesType === 'blogposts') {
        return 'title' in entry && typeof entry.title === 'string' ? entry.title : '';
    }

    // Only `ModelType` in the union declares `model`, so this narrows to it and
    // shares the one display rule with every other model name on screen.
    if (capabilitiesType === 'models') {
        return 'model' in entry ? modelDisplayName(entry) : '';
    }

    if ('name' in entry && typeof entry.name === 'string') {
        return entry.name;
    }

    return '';
}
