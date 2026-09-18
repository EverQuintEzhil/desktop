import { PencilIcon } from 'lucide-react';
import { useMemo } from 'react';

import DirectiveLabel from '@/components/chat/primitives/directive-label';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { parseDirectiveText } from '@/lib/chat/directives';

import { useRoutineMentionItems } from '../hooks/use-routine-mention-items';

interface Props {
    prompt: string;
    /** Resolves what the prompt mentions, so a connector chip can carry its own favicon and description. */
    agentId: string;
    onEdit: () => void;
}

const RoutineInstructionsCard = ({ prompt, agentId, onEdit }: Props) => {
    const hasPrompt = Boolean(prompt.trim());
    const hasDirective = useMemo(
        () => parseDirectiveText(prompt).some((segment) => segment.type === 'directive'),
        [prompt],
    );
    // Resolving mentions costs the agent's whole capability payload; an empty id switches that off.
    const { items } = useRoutineMentionItems(hasDirective ? agentId : '');

    const renderContent = () => {
        if (!hasPrompt) {
            return <p className="p-4 text-sm leading-6 text-muted-foreground">No instructions for this routine</p>;
        }

        return (
            // The stored prompt is composer-serialized text, not markdown: an @-mention is a
            // `:mcp[...]` directive, which markdown renders verbatim.
            <div className="routine-instructions-card-content-text scrollbar-controller scrollbar-vertical scrollbar-track-transparent p-4 text-sm leading-6 whitespace-pre-wrap text-text-secondary lg:max-h-48">
                <DirectiveLabel text={prompt} suggestions={items} />
            </div>
        );
    };

    return (
        <div className="routine-instructions-card flex flex-col gap-2">
            <div className="routine-instructions-card-header flex h-6 items-center justify-between gap-2 px-1">
                <span className="text-sm font-medium text-foreground">Instructions</span>
                <SimpleTooltip content="Edit instructions" side="bottom">
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 rounded-md"
                        aria-label="Edit instructions"
                        onClick={onEdit}
                    >
                        <PencilIcon className="size-3.5" />
                    </Button>
                </SimpleTooltip>
            </div>
            <div className="routine-instructions-card-content overflow-hidden rounded-2xl border border-border-secondary bg-card">
                {renderContent()}
            </div>
        </div>
    );
};

export default RoutineInstructionsCard;
