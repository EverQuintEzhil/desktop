export const MAX_TRIGGER_ITEMS = 7;

/**
 * The "@" list spans tools, skills and connectors — including the user's custom and enterprise
 * ones — so it needs far more room than the "/" command list. The menu scrolls past this.
 */
export const MAX_MENTION_TRIGGER_ITEMS = 24;

export const DIRECTIVE_SECTION_LABELS: Record<string, string> = {
    tool: 'Tools',
    skill: 'Skills',
    datastore: 'Data Stores',
    mcp: 'Connectors',
    model: 'Models',
    agent: 'Agents',
};

export const TRIGGER_COMMAND_MAX_WIDTH = 216;
export const TRIGGER_COMMAND_VIEWPORT_MARGIN = 40;
