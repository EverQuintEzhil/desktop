import { PlusIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { SelectSuggestionItem } from '@/components';
import SearchInput from '@/components/search-input';
import { Button } from '@/components/ui/button';
import Select from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { TagType } from '@/types/admin';
import type { TenantType } from '@/types/store';

import './search.scss';

interface Props {
    search: string;
    setSearch: (val: string) => void;
    categoryFilter: SelectSuggestionItem<string> | null;
    setCategoryFilter: (val: SelectSuggestionItem<string> | null) => void;
    tags: Array<Pick<TagType, 'name' | 'value'>>;
    tenant: TenantType;
    createAgentTo?: string;
    hideCategoryFilter?: boolean;
    hideSearchInput?: boolean;
}

const Search = (props: Props) => {
    const {
        search,
        setSearch,
        categoryFilter,
        setCategoryFilter,
        tags,
        tenant,
        createAgentTo,
        hideCategoryFilter = false,
        hideSearchInput = false,
    } = props;

    const availableTags =
        tags?.map((tag) => ({
            label: tag.name,
            value: tag.value,
        })) || [];

    const showCategoryFilter = !hideCategoryFilter;
    const showSearchInput = !hideSearchInput;
    const showCreateAgent = createAgentTo !== undefined;
    const showInputRow = showSearchInput || showCreateAgent;

    if (!showCategoryFilter && !showInputRow) {
        return null;
    }

    const renderCategoryFilter = () => (
        <Select
            value={categoryFilter?.value || ''}
            onChange={(val) => {
                const valueStr = val != null ? String(val) : '';
                const selectedTag = availableTags.find((tag) => tag.value === valueStr);

                setCategoryFilter({
                    label: selectedTag?.label || 'All',
                    value: valueStr,
                });
            }}
            options={availableTags}
            popoverClassName="min-w-[180px]"
            className={cn(
                'select-solid text-md min-h-[45px] w-full max-w-[140px] justify-between rounded-full border-0 px-3 font-medium',
                'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1',
                '[&_i]:text-primary-foreground! [&_span]:text-primary-foreground',
            )}
        />
    );

    const renderInputRow = () => (
        <div className="flex max-w-full flex-1 items-center gap-4 max-sm:w-full">
            {showSearchInput ? (
                <SearchInput
                    searchOnChange
                    onChange={(val: string) => {
                        setSearch(val);
                    }}
                    placeholder={`Search for AI agents in ${tenant.name}`}
                    search={search}
                    className="max-w-full"
                    inputClassName="rounded-3xl border-0 shadow-surface text-base h-[45px]"
                />
            ) : null}
            {createAgentTo === undefined ? null : (
                <Button asChild className="create-agent-btn">
                    <Link to={createAgentTo}>
                        <PlusIcon size={20} strokeWidth={2.4} />
                        Create Agent
                    </Link>
                </Button>
            )}
        </div>
    );

    return (
        <div className="search-dropdown flex flex-1 items-center justify-between gap-4 max-sm:flex-col max-sm:flex-wrap max-sm:items-start max-sm:gap-6">
            {showCategoryFilter ? renderCategoryFilter() : null}
            {showInputRow ? renderInputRow() : null}
        </div>
    );
};

export default Search;
