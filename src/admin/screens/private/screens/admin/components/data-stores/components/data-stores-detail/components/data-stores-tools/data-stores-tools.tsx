import { PlusIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DataStoreType, ToolType } from '@/types/admin';

import '../../data-stores-detail.scss';

import { AddCustomTool, AddTemplateTool } from './components';
import './data-stores-tools.scss';

interface Props {
    dataStore: DataStoreType;
    canUserEdit: boolean;
    onSubmit: (value: DataStoreType) => void;
}

const DataStoresTools = (props: Props) => {
    const { dataStore } = props;
    const dataStoreTools = dataStore?.tools;
    const navigate = useNavigate();
    const [isCustomToolAddOpen, setIsCustomToolAddOpen] = useState(false);
    const [isTemplateToolAddOpen, setIsTemplateToolAddOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return dataStoreTools;

        const lower = search.toLowerCase();

        return dataStoreTools?.filter(
            (t) => t.name.toLowerCase().includes(lower) || t.description.toLowerCase().includes(lower),
        );
    }, [dataStoreTools, search]);

    const renderCustomToolAdd = () => {
        if (!isCustomToolAddOpen) {
            return null;
        }

        return (
            <AddCustomTool
                isOpen={isCustomToolAddOpen}
                onClose={() => {
                    setIsCustomToolAddOpen(false);
                }}
                onAddTool={(tool: ToolType) => {
                    navigate(`/admin/tools/${tool._id}`);
                }}
                dataStore={dataStore}
            />
        );
    };

    const renderTemplateToolAdd = () => {
        if (!isTemplateToolAddOpen) {
            return null;
        }

        return (
            <AddTemplateTool
                isOpen={isTemplateToolAddOpen}
                onClose={() => {
                    setIsTemplateToolAddOpen(false);
                }}
                onAddTool={(tool: ToolType) => {
                    navigate(`/admin/tools/${tool._id}`);
                }}
                dataStore={dataStore}
            />
        );
    };

    return (
        <div className="tab-content data-stores-tab flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <div className="mb-4 flex items-center justify-end gap-4">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setIsCustomToolAddOpen(true);
                        }}
                    >
                        <PlusIcon />
                        Create Custom Tool
                    </Button>
                    {dataStore.provider !== 'files' && (
                        <Button
                            size="sm"
                            onClick={() => {
                                setIsTemplateToolAddOpen(true);
                            }}
                        >
                            <PlusIcon />
                            Create Tool from Templates
                        </Button>
                    )}
                </div>

                <div className="mb-2 flex items-center gap-3">
                    <div className="tool-search-wrapper flex-1">
                        <SearchIcon className="tool-search-icon size-4" />
                        <Input
                            className="tool-search-input"
                            placeholder="Search tools..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="tool-list scrollbar-controller scrollbar-vertical scrollbar-horizontal">
                    {filtered.length === 0 && (
                        <div className="flex items-center justify-center p-8">
                            <span className="text-sm text-muted-foreground">No tools found.</span>
                        </div>
                    )}
                    {filtered?.map((tool) => (
                        <div
                            key={tool.refName}
                            role="button"
                            tabIndex={0}
                            className={cn('tool-row flex items-center gap-3')}
                            onClick={() => navigate(`/admin/tools/${tool._id}`)}
                        >
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="tool-name">{tool.name}</span>
                                <span className="tool-description">{tool.description}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {renderCustomToolAdd()}
            {renderTemplateToolAdd()}
        </div>
    );
};

export default DataStoresTools;
