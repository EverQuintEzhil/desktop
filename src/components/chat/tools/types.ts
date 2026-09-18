import type { ToolCallMessagePartComponent } from '@assistant-ui/react';

export interface ChatToolRenderer {
    toolName: string;
    render: ToolCallMessagePartComponent;
}
