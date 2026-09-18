import {
    BotIcon,
    ExternalLinkIcon,
    FilesIcon,
    FileTextIcon,
    GlobeIcon,
    LayersIcon,
    LinkIcon,
    LockIcon,
    type LucideIcon,
    MapIcon,
    PencilIcon,
    PlusIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { BORDER_HOVER_CLASS_NAME, SURFACE_HOVER_CLASS_NAME } from '@/components/file-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    useWizardSaveConnectionMutation,
    useWizardSaveWeblinksMutation,
    type WeblinkSpec,
} from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';
import type { DataStoreType } from '@/types/admin';
import { showErrorToast, showSuccessToast } from '@/utils';

import { parseWeblinksLinks } from '../../../wizard-pages/configure-weblinks-step/weblinks-validation';

import { WebLinksInlineEditor } from './web-links-inline-editor';

interface Props {
    dataStore: DataStoreType;
    canUserEdit: boolean;
    /** Optional: the save mutation already writes the saved store into the detail query cache. */
    onSubmit?: (value: DataStoreType) => void;
}

const DEFAULT_MAX_PAGES = 2000;
const DEFAULT_MAX_DEPTH = 5;

interface LinkDetail {
    key: string;
    icon: LucideIcon;
    label: string;
    /** Native tooltip for values too long to render inline (e.g. the sitemap URL). */
    title?: string;
}

/** The crawl/scrape settings worth surfacing on a collapsed link row, in reading order. */
const getLinkDetails = (link: WeblinkSpec): LinkDetail[] => {
    const details: LinkDetail[] = [];

    if (link.type === 'crawl') {
        details.push({
            key: 'sitemap',
            icon: MapIcon,
            label: link.siteMapLink ? 'Sitemap provided' : 'Auto-discovered sitemap',
            title: link.siteMapLink,
        });
        details.push({
            key: 'pages',
            icon: FilesIcon,
            label: `Up to ${link.maxPages ?? DEFAULT_MAX_PAGES} pages`,
        });
        details.push({
            key: 'depth',
            icon: LayersIcon,
            label: `Depth ${link.maxDepth ?? DEFAULT_MAX_DEPTH}`,
        });
    }

    details.push({
        key: 'robots',
        icon: BotIcon,
        label: link.respectRobots === false ? 'Ignores robots.txt' : 'Respects robots.txt',
    });

    if (link.auth && link.auth !== 'none') {
        details.push({
            key: 'auth',
            icon: LockIcon,
            label: link.auth === 'basic' ? 'Basic auth' : 'WordPress auth',
        });
    }

    return details;
};

const LinkThumb = ({ link }: { link: WeblinkSpec }) => {
    const Icon = link.type === 'crawl' ? GlobeIcon : FileTextIcon;

    return (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
        </span>
    );
};

const LinkDetailChip = ({ detail }: { detail: LinkDetail }) => {
    const { icon: Icon, label, title } = detail;

    return (
        <span
            title={title}
            className="inline-flex items-center gap-1 rounded-md border border-border-secondary bg-card px-1.5 py-0.5 text-xs text-text-secondary"
        >
            <Icon className="size-3 shrink-0" aria-hidden="true" />
            {label}
        </span>
    );
};

const DataStoresWebLinks = ({ dataStore, canUserEdit, onSubmit }: Props) => {
    const saveWeblinksMutation = useWizardSaveWeblinksMutation();
    const saveConnectionMutation = useWizardSaveConnectionMutation();
    // 'add' opens the editor with a fresh blank row; 'edit' opens it on the existing links as-is.
    const [editMode, setEditMode] = useState<'add' | 'edit' | null>(null);

    const links = useMemo(() => parseWeblinksLinks(dataStore.specification), [dataStore.specification]);
    const isSaving = saveWeblinksMutation.isPending || saveConnectionMutation.isPending;
    const isEditing = editMode !== null;

    const handleSave = async (nextLinks: WeblinkSpec[], authPayload: { auth: Record<string, unknown> } | null) => {
        const result = await saveWeblinksMutation.mutateAsync({
            id: dataStore._id,
            data: { links: nextLinks },
        });

        if (authPayload) {
            await saveConnectionMutation.mutateAsync({ id: dataStore._id, data: authPayload });
        }

        onSubmit?.(result);
        showSuccessToast('Web links saved successfully.');
        setEditMode(null);
    };

    const openLink = (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const renderAddLinkCard = () => {
        if (!canUserEdit || isEditing) return null;

        return (
            <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditMode('add')}
                    className={cn(
                        'group h-auto flex-1 justify-start gap-3 rounded-2xl border border-dashed border-border-secondary bg-card px-4 py-4',
                        'text-left text-foreground transition-colors duration-140 disabled:opacity-60',
                        SURFACE_HOVER_CLASS_NAME,
                        BORDER_HOVER_CLASS_NAME,
                    )}
                >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <PlusIcon className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium transition-colors group-hover:text-primary">Add link</span>
                        <span className="text-xs text-text-secondary">Crawl a whole site or scrape a single page</span>
                    </span>
                </Button>
            </div>
        );
    };

    const renderEmptyState = () => (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-border-secondary bg-card p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <LinkIcon className="size-6" />
            </span>
            <span className="text-sm font-medium">No links added yet</span>
            <span className="max-w-sm text-sm text-text-secondary">
                {canUserEdit
                    ? 'Click "Add link" above to choose the pages or sites this data store should crawl or scrape.'
                    : 'Web links added to this data store will appear here.'}
            </span>
        </div>
    );

    const renderLinksList = () => (
        <div className="flex flex-col gap-3">
            <div className="flex min-h-8 items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{`Web Links (${links.length})`}</span>
                {canUserEdit && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditMode('edit')}>
                        <PencilIcon className="size-3.5" />
                        Edit links
                    </Button>
                )}
            </div>

            <ul className="flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card">
                {links.map((link, index) => (
                    <li
                        key={`${link.url}-${index}`}
                        className={cn(
                            'group flex cursor-pointer items-center gap-3 border-t border-border-secondary px-4 py-3 first:border-t-0',
                            'transition-colors duration-140',
                            SURFACE_HOVER_CLASS_NAME,
                        )}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${link.url} in a new tab`}
                        onClick={() => openLink(link.url)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openLink(link.url);
                            }
                        }}
                    >
                        <LinkThumb link={link} />

                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <span className="flex min-w-0 flex-wrap items-center gap-2">
                                <span className="line-clamp-1 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                                    {link.url}
                                </span>
                                <Badge variant="outline" className="shrink-0 text-xs">
                                    {link.type === 'crawl' ? 'Crawl' : 'Single page'}
                                </Badge>
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5">
                                {getLinkDetails(link).map((detail) => (
                                    <LinkDetailChip key={detail.key} detail={detail} />
                                ))}
                            </span>
                        </span>

                        <ExternalLinkIcon
                            className="size-4 shrink-0 text-text-secondary opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden="true"
                        />
                    </li>
                ))}
            </ul>
        </div>
    );

    const renderContent = () => {
        if (isEditing) {
            return (
                <WebLinksInlineEditor
                    initialLinks={links}
                    isSaving={isSaving}
                    startWithNewRow={editMode === 'add'}
                    onCancel={() => setEditMode(null)}
                    onSave={async (nextLinks, authPayload) => {
                        try {
                            await handleSave(nextLinks, authPayload);
                        } catch (error) {
                            console.error(error);
                            showErrorToast('Failed to save web links. Please try again.');
                            throw error;
                        }
                    }}
                />
            );
        }

        return links.length === 0 ? renderEmptyState() : renderLinksList();
    };

    return (
        <div className="data-stores-web-links-container flex min-h-[60svh] w-full flex-col gap-4 p-4">
            {renderAddLinkCard()}
            {renderContent()}
        </div>
    );
};

export default DataStoresWebLinks;
