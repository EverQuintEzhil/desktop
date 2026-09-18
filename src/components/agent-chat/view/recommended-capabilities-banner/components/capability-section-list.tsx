import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface CapabilitySectionItem {
    key: string;
    name: string;
    icon: LucideIcon;
    /** Trailing control. An item without one renders as an inert row. */
    action?: ReactNode;
    title?: string;
}

export interface CapabilitySectionListItems {
    kind: string;
    label: string;
    items: CapabilitySectionItem[];
    /** Control for the whole section, shown beside its heading. */
    headerAction?: ReactNode;
}

interface Props {
    sections: CapabilitySectionListItems[];
}

const renderRow = (item: CapabilitySectionItem) => {
    const Icon = item.icon;

    return (
        <div
            key={item.key}
            className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-b-0"
        >
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate" title={item.title ?? item.name}>
                    {item.name}
                </span>
            </span>
            {item.action}
        </div>
    );
};

const renderSection = (section: CapabilitySectionListItems) => (
    <section key={section.kind} className="flex flex-col pt-3 first:pt-0">
        <div className="flex items-center justify-between gap-3 pb-1">
            <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{section.label}</h3>
            {section.headerAction}
        </div>
        {section.items.map(renderRow)}
    </section>
);

/** Both overflow dialogs list their items through this, so the two cannot drift apart. */
const CapabilitySectionList = ({ sections }: Props) => (
    <div className="flex flex-col">{sections.map(renderSection)}</div>
);

export default CapabilitySectionList;
