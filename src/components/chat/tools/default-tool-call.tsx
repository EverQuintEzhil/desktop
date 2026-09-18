import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import type { ReactNode } from 'react';

import { ToolFallback } from '@/components/assistant-ui/tool-fallback';

export const DefaultToolCall: ToolCallMessagePartComponent = (part) => {
    const toolUI = (part as { toolUI?: ReactNode }).toolUI;

    if (toolUI) return <>{toolUI}</>;

    return <ToolFallback {...part} />;
};
