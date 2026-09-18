import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { CheckboxGroup, type CheckBoxOptionObj } from '@/components/checkbox-group';
import { Button } from '@/components/ui/button';
import DateRangeFilter, { type DateRangeValue } from '@/components/ui/date-range-filter';
import Select from '@/components/ui/select';
import { adminUsersApi } from '@/lib/api/admin/users';
import type { UserType } from '@/types/admin';

import '../conversations/conversations.scss';

interface SortOption {
    value: string;
    label: string;
}

const SORT_OPTIONS: SortOption[] = [
    { value: 'created_at:desc', label: 'Created At (Desc)' },
    { value: 'created_at:asc', label: 'Created At (Asc)' },
    { value: 'updated_at:desc', label: 'Updated At (Desc)' },
    { value: 'updated_at:asc', label: 'Updated At (Asc)' },
];

export interface ConversationFiltersValue {
    sortBy: SortOption;
    users: CheckBoxOptionObj[];
    createdRange: DateRangeValue;
    updatedRange: DateRangeValue;
}

export const DEFAULT_CONVERSATION_FILTERS: ConversationFiltersValue = {
    sortBy: { value: 'updated_at:desc', label: 'Updated At (Desc)' },
    users: [],
    createdRange: { from: '', to: '' },
    updatedRange: { from: '', to: '' },
};

const DATE_FILTER_CLASSES =
    'single-filter date-filter flex-col [&>div]:w-full [&_button]:w-full [&_button]:justify-between';

interface Props {
    isOpen: boolean;
    value: ConversationFiltersValue;
    onClose: () => void;
    onApply: (filters: ConversationFiltersValue) => void;
}

const Filters = (props: Props) => {
    const { isOpen, value, onClose, onApply } = props;
    const [draft, setDraft] = useState<ConversationFiltersValue>(value);

    useEffect(() => {
        if (isOpen) setDraft(value);
    }, [isOpen, value]);

    const fetchUsers = async (query: string, pageNo: number) => {
        const result = await adminUsersApi.list({ page: pageNo, size: 20, search: query });

        return {
            list: result.values.map((val: UserType) => ({
                value: val._id,
                label: val.name.first + ' ' + val.name.last,
                key: val._id,
            })),
            pageInfo: {
                page: result.pageInfo.page,
                totalPages: result.pageInfo.totalPages,
            },
        };
    };

    const handleCreatedDateChange = (key: 'from' | 'to', dateValue: string) => {
        setDraft((prev) => ({ ...prev, createdRange: { ...prev.createdRange, [key]: dateValue } }));
    };

    const handleUpdatedDateChange = (key: 'from' | 'to', dateValue: string) => {
        setDraft((prev) => ({ ...prev, updatedRange: { ...prev.updatedRange, [key]: dateValue } }));
    };

    const hasChanges =
        draft.sortBy.value !== DEFAULT_CONVERSATION_FILTERS.sortBy.value ||
        draft.users.length > 0 ||
        !!draft.createdRange.from ||
        !!draft.createdRange.to ||
        !!draft.updatedRange.from ||
        !!draft.updatedRange.to;

    return (
        <div className={`side-sheet flex flex-col ${isOpen ? 'open' : ''}`}>
            <div className="side-sheet-header sticky top-0 z-1 flex items-center justify-end py-1.5">
                {hasChanges && (
                    <Button
                        variant="ghost"
                        size="xs"
                        className="mr-auto rounded-full text-muted-foreground"
                        onClick={() => {
                            setDraft(DEFAULT_CONVERSATION_FILTERS);
                        }}
                    >
                        Clear All
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-full"
                    onClick={() => {
                        onClose();
                    }}
                >
                    <XIcon />
                </Button>
            </div>
            <div className="side-sheet-body flex flex-col gap-4 py-3">
                <div className="single-filter sort-filter flex flex-col gap-2">
                    <span className="text-sm">Sort By</span>
                    <Select<string>
                        placeholder="Select"
                        variant="ghost"
                        options={SORT_OPTIONS}
                        value={draft.sortBy.value}
                        onChange={(val) => {
                            if (val == null) return;
                            const option = SORT_OPTIONS.find((item) => item.value === val);

                            setDraft((prev) => ({ ...prev, sortBy: option ?? { value: val, label: val } }));
                        }}
                    />
                </div>
                <div className="single-filter multi-select-filter flex flex-col gap-2">
                    <span className="text-sm">Users</span>
                    <CheckboxGroup
                        search
                        data={fetchUsers}
                        name={'users'}
                        value={draft.users}
                        icon={{
                            icon: SearchIcon,
                        }}
                        onChange={(users) => setDraft((prev) => ({ ...prev, users }))}
                    />
                </div>
                <DateRangeFilter
                    label="Created"
                    className={DATE_FILTER_CLASSES}
                    value={draft.createdRange}
                    onDateChange={handleCreatedDateChange}
                    startAriaLabel="Created date start"
                    endAriaLabel="Created date end"
                />
                <DateRangeFilter
                    label="Updated"
                    className={DATE_FILTER_CLASSES}
                    value={draft.updatedRange}
                    onDateChange={handleUpdatedDateChange}
                    startAriaLabel="Updated date start"
                    endAriaLabel="Updated date end"
                />
            </div>
            <div className="side-sheet-footer sticky bottom-0 z-1 mt-auto flex items-center justify-between px-4 py-1.5">
                <Button variant="ghost" size="xs" className="rounded-full" onClick={onClose}>
                    Close
                </Button>
                <Button
                    size="xs"
                    className="rounded-full"
                    onClick={() => {
                        onApply(draft);
                    }}
                >
                    Apply
                </Button>
            </div>
        </div>
    );
};

export default Filters;
