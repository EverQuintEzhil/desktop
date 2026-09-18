import { SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import SpinnerBlade from '@/components/ui/spinner';
import { useWizardSaveToolsMutation, useWizardTemplatesQuery } from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';
import type { DataStoreType } from '@/types/admin';
import { showErrorToast, showSuccessToast } from '@/utils';

import '../../data-stores-detail.scss';

import './data-stores-templates.scss';
import { TEMPLATE_KEY_COLORS } from './types';

interface Props {
    dataStore: DataStoreType;
    canUserEdit: boolean;
    onSubmit: (value: DataStoreType) => void;
}

const DataStoresTemplates = (props: Props) => {
    const { dataStore, onSubmit } = props;
    const saveToolsMutation = useWizardSaveToolsMutation();
    const templatesQuery = useWizardTemplatesQuery(dataStore._id);
    const tools = dataStore?.tools;
    const templates = templatesQuery.data ?? [];
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(
        tools ? new Set(tools.map((tool) => tool.refName)) : new Set(),
    );
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return templates;

        const lower = search.toLowerCase();

        return templates.filter(
            (t) => t.name.toLowerCase().includes(lower) || t.description.toLowerCase().includes(lower),
        );
    }, [templates, search]);

    const isAllSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.refName));
    const isSomeSelected = !isAllSelected && filtered.some((t) => selected.has(t.refName));

    const handleToggleAll = (_: unknown, checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);

            filtered.forEach((t) => {
                if (checked) next.add(t.refName);
                else next.delete(t.refName);
            });

            return next;
        });
    };

    const handleToggle = (refName: string, checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);

            if (checked) next.add(refName);
            else next.delete(refName);

            return next;
        });
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const result = await saveToolsMutation.mutateAsync({
                id: dataStore._id,
                data: { refNames: Array.from(selected) },
            });

            showSuccessToast('Templates saved successfully.');
            onSubmit(result as DataStoreType);
        } catch (error) {
            console.error(error);
            showErrorToast('Failed to save templates.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (templatesQuery.isPending) {
        return (
            <div className="binary-loading-wrapper flex items-center justify-center px-4 py-6">
                <div className="flex flex-col items-center justify-center gap-6">
                    <SpinnerBlade className="scale-150" />
                    <span className="text-sm">Fetching Templates...</span>
                </div>
            </div>
        );
    }
    if (templatesQuery.isError) {
        return (
            <div className="flex items-center justify-center px-4 py-6">
                <div className="flex flex-col items-center justify-center gap-6">
                    <h2 className="text-center font-medium">Error Fetching Templates</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="tab-content data-stores-tab flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Templates</span>
                    {selected.size > 0 && (
                        <span className="template-count-badge">
                            {selected.size}
                            {' of '}
                            {templates.length}
                            {' selected'}
                        </span>
                    )}
                </div>
                <Button size="sm" onClick={handleSave} disabled={isSubmitting || selected.size === 0}>
                    {isSubmitting ? <SpinnerBlade className="scale-75" /> : null}
                    {isSubmitting ? 'Saving...' : 'Save'}
                </Button>
            </div>

            <div className="flex items-center gap-3">
                <div className="template-search-wrapper flex-1">
                    <SearchIcon className="template-search-icon size-4" />
                    <Input
                        className="template-search-input"
                        placeholder="Search templates..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Checkbox
                    checked={isAllSelected}
                    indeterminate={isSomeSelected}
                    label={isAllSelected ? 'Deselect all' : 'Select all'}
                    onChange={handleToggleAll}
                />
            </div>

            <div className="template-list">
                {filtered.length === 0 && (
                    <div className="flex items-center justify-center p-8">
                        <span className="text-sm text-muted-foreground">No tools found.</span>
                    </div>
                )}
                {filtered.map((template) => (
                    <div
                        key={template.refName}
                        role="button"
                        tabIndex={0}
                        className={cn(
                            'template-row flex items-center gap-3',
                            selected.has(template.refName) && 'selected',
                        )}
                        onClick={() => handleToggle(template.refName, !selected.has(template.refName))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleToggle(template.refName, !selected.has(template.refName));
                            }
                        }}
                    >
                        <Checkbox
                            checked={selected.has(template.refName)}
                            onChange={(_, checked) => handleToggle(template.refName, checked)}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="template-name">{template.name}</span>
                            <span className="template-description">{template.description}</span>
                        </div>
                        <span
                            className={cn(
                                'template-key-badge',
                                TEMPLATE_KEY_COLORS[template.templateKey] ?? 'template-key-other',
                            )}
                        >
                            {template.templateKey}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DataStoresTemplates;
