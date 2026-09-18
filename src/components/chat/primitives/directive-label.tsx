import type { FC, ReactNode } from 'react';

import { buildConnectorFaviconUrl } from '@/lib/chat/connector-favicon';
import { parseDirectiveText, type Directive } from '@/lib/chat/directives';

import type { DirectiveSuggestion } from './directive-text';

interface DirectiveLabelProps {
    text: string;
    suggestions?: DirectiveSuggestion[];
}

const renderDirectiveSegment = (key: string, directive: Directive, faviconUrl?: string): ReactNode => {
    if (faviconUrl) {
        return (
            <span key={key} className="inline-flex items-baseline gap-1 text-primary">
                <img src={faviconUrl} alt="" className="size-3.5 shrink-0 self-center rounded-[3px] object-contain" />
                {directive.label}
            </span>
        );
    }

    return (
        <span key={key} className="text-primary">
            {directive.type === 'tool' ? '' : '@'}
            {directive.label}
        </span>
    );
};

/**
 * Single-line, tooltip-free rendering of chip-serialized composer text, for rows that
 * truncate to one line (message nav rail, queued-messages panel). Use DirectiveText
 * where the full interactive chips and hover cards are wanted.
 */
const DirectiveLabel: FC<DirectiveLabelProps> = ({ text, suggestions }) => (
    <>
        {parseDirectiveText(text).map((segment, index) => {
            const key = `${index}-${segment.text}`;

            if (segment.type === 'text') return <span key={key}>{segment.text}</span>;

            const { directive } = segment;
            const match = suggestions?.find((s) => s.id === directive.id && s.type === directive.type);
            const faviconUrl = directive.type === 'mcp' ? buildConnectorFaviconUrl(match?.serverUrl, 32) : undefined;

            return renderDirectiveSegment(key, directive, faviconUrl);
        })}
    </>
);

export default DirectiveLabel;
