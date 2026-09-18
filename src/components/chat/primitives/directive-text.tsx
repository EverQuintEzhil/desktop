import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { WrenchIcon } from 'lucide-react';
import { useState, type FC, type ReactNode } from 'react';

import { buildConnectorFaviconUrl } from '@/lib/chat/connector-favicon';
import { parseDirectiveText, type Directive } from '@/lib/chat/directives';
import { cn } from '@/lib/utils';

import { DirectiveTooltipContent } from './directive-tooltip-content';

export interface DirectiveSuggestion {
    id: string;
    type: string;
    description?: string;
    serverUrl?: string;
}

interface DirectiveTextProps {
    text: string;
    suggestions?: DirectiveSuggestion[];
}

const renderDirectiveIcon = (type: string): ReactNode => {
    if (type === 'tool') {
        return <WrenchIcon className="size-3.5 shrink-0 self-center" />;
    }

    return <span>@</span>;
};

const DirectiveChip = ({
    directive,
    description,
    showTooltip,
    faviconUrl,
}: {
    directive: Directive;
    description?: string;
    showTooltip: boolean;
    faviconUrl?: string;
}) => {
    const [faviconError, setFaviconError] = useState(false);
    const showFavicon = Boolean(faviconUrl) && !faviconError;

    const chip = (
        <span
            className={cn(
                // items-baseline, with the icon opted out via self-center: an inline-flex box takes its
                // baseline from the first baseline-aligned item, so the label — not the icon box — is what
                // lines up with the surrounding message text.
                'inline-flex max-w-full items-baseline gap-1 text-primary',
                showTooltip ? 'cursor-pointer' : 'cursor-default',
            )}
            title={!showTooltip ? `:${directive.type}[${directive.label}]{name=${directive.id}}` : undefined}
            aria-label={`${directive.type}: ${directive.label}`}
        >
            {showFavicon ? (
                <img
                    src={faviconUrl}
                    alt=""
                    className="size-3.5 shrink-0 self-center rounded-[3px] object-contain"
                    onError={() => setFaviconError(true)}
                />
            ) : (
                renderDirectiveIcon(directive.type)
            )}
            <span className="truncate">{directive.label}</span>
        </span>
    );

    if (showTooltip) {
        return (
            <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>{chip}</TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        sideOffset={4}
                        className={cn(
                            'z-9999 w-60',
                            'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out',
                            'data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
                            'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
                            'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
                        )}
                    >
                        <DirectiveTooltipContent
                            description={description}
                            type={directive.type}
                            label={directive.label}
                        />
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        );
    }

    return chip;
};

const DirectiveText: FC<DirectiveTextProps> = ({ text, suggestions }) => {
    const content = parseDirectiveText(text).map((segment, index) => {
        if (segment.type === 'text' || !segment.directive) {
            return <span key={`${index}-${segment.text}`}>{segment.text}</span>;
        }

        const matchingSuggestion = suggestions?.find(
            (s) => s.id === segment.directive.id && s.type === segment.directive.type,
        );
        const desc = matchingSuggestion?.description;

        return (
            <DirectiveChip
                key={`${index}-${segment.text}`}
                directive={segment.directive}
                description={desc}
                showTooltip={Boolean(matchingSuggestion)}
                faviconUrl={
                    segment.directive.type === 'mcp'
                        ? buildConnectorFaviconUrl(matchingSuggestion?.serverUrl, 32)
                        : undefined
                }
            />
        );
    });

    if (suggestions && suggestions.length > 0) {
        return <TooltipPrimitive.Provider delayDuration={200}>{content}</TooltipPrimitive.Provider>;
    }

    return <>{content}</>;
};

export default DirectiveText;
