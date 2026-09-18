import { z } from 'zod';

import type { AgentPinScope } from '@/lib/api/app/agent-layout';

import { AGENT_PIN_LIMIT } from './constants';

/** Read-time dedupe and cap: a duplicate id would make `indexOf` in a reorder address the wrong occurrence. */
const normalizePinned = (pinned: string[]): string[] => Array.from(new Set(pinned)).slice(0, AGENT_PIN_LIMIT);

/**
 * `.optional()` wraps the transform rather than the reverse, so an absent key stays absent instead
 * of becoming `[]`: absent resolves to the defaults, `[]` means the user pinned nothing on purpose.
 */
const pinnedListSchema = z.array(z.string()).transform(normalizePinned).optional();

/** Typed as a full record of scopes, so a new scope cannot be added to the union without a schema. */
const agentLayoutShape: Record<AgentPinScope, typeof pinnedListSchema> = {
    my: pinnedListSchema,
    firm: pinnedListSchema,
};

export const agentLayoutSchema = z.object(agentLayoutShape);

export type AgentLayout = z.infer<typeof agentLayoutSchema>;
