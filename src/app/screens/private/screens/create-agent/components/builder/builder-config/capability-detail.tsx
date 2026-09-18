import { CheckIcon, InfoIcon, LightbulbIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Section {
    title: string;
    body: string;
}

// Capability detail markdown is a flat list of `**Header**` sections
// (see capability-info/*.md). Parse into sections so each one can get
// its own visual treatment instead of rendering as one wall of text.
const parseSections = (detail: string): Section[] => {
    const sections: Section[] = [];
    let current: Section | null = null;

    for (const line of detail.split('\n')) {
        const header = line.match(/^\*\*(.+)\*\*\s*$/);

        if (header) {
            current = { title: header[1], body: '' };
            sections.push(current);
            continue;
        }

        if (current) current.body += `${line}\n`;
    }

    return sections.map((section) => ({ ...section, body: section.body.trim() }));
};

// Bodies only use `**bold**` and `*italic*` inline markup.
const renderInline = (text: string): ReactNode[] =>
    text
        .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
        .filter(Boolean)
        .map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return (
                    <strong key={index} className="font-medium text-foreground">
                        {part.slice(2, -2)}
                    </strong>
                );
            }

            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={index}>{part.slice(1, -1)}</em>;
            }

            return <span key={index}>{part}</span>;
        });

const renderBody = (body: string, itemIcon?: ReactNode) =>
    body
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block, blockIndex) => {
            const lines = block.split('\n');
            const isList = lines.every((line) => line.trimStart().startsWith('- '));

            if (isList) {
                return (
                    <ul key={blockIndex} className="m-0 flex list-none flex-col gap-2 p-0">
                        {lines.map((line, lineIndex) => (
                            <li key={lineIndex} className="flex items-start gap-2.5">
                                {itemIcon ?? (
                                    <span
                                        className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary/60"
                                        aria-hidden="true"
                                    />
                                )}
                                <span className="leading-relaxed">{renderInline(line.trimStart().slice(2))}</span>
                            </li>
                        ))}
                    </ul>
                );
            }

            return (
                <p key={blockIndex} className="m-0 leading-relaxed">
                    {renderInline(block)}
                </p>
            );
        });

const SectionLabel = ({ children }: { children: ReactNode }) => (
    <span className="text-xs font-semibold tracking-wide text-text-secondary uppercase">{children}</span>
);

const renderSection = (section: Section) => {
    const key = section.title.toLowerCase();

    if (key === 'what it is') {
        return (
            <div key={key} className="flex flex-col gap-2 text-sm text-foreground">
                {renderBody(section.body)}
            </div>
        );
    }

    if (key === 'example') {
        return (
            <div
                key={key}
                className={
                    'flex flex-col gap-2 rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,var(--border))] ' +
                    'bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))] p-3.5 text-sm text-muted-foreground'
                }
            >
                <span className="flex items-center gap-1.5">
                    <LightbulbIcon size={13} className="text-primary" aria-hidden="true" />
                    <SectionLabel>{section.title}</SectionLabel>
                </span>
                {renderBody(section.body)}
            </div>
        );
    }

    if (key === 'good to know') {
        return (
            <div key={key} className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <InfoIcon size={13} className="text-text-secondary" aria-hidden="true" />
                    <SectionLabel>{section.title}</SectionLabel>
                </span>
                {renderBody(section.body)}
            </div>
        );
    }

    // "What your agent can do with it", "Why it matters", and any future bullet sections.
    return (
        <div key={key} className="flex flex-col gap-2.5 text-sm text-muted-foreground">
            <SectionLabel>{section.title}</SectionLabel>
            {renderBody(
                section.body,
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,var(--surface))]">
                    <CheckIcon size={10} className="text-primary" aria-hidden="true" />
                </span>,
            )}
        </div>
    );
};

const CapabilityDetail = ({ detail }: { detail: string }) => (
    <div className="flex flex-col gap-5">{parseSections(detail).map(renderSection)}</div>
);

export default CapabilityDetail;
