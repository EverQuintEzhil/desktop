import { XIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import Select, { type SelectSuggestionItem } from '@/components/ui/select';
import { adminUsersApi } from '@/lib/api/admin/users';
import type { UserType } from '@/types/admin';

import '../histories/histories.scss';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onApply: (sortBy: SelectSuggestionItem<string>, creatorId: string | null) => void;
}

const Filters = (props: Props) => {
    const { isOpen, onClose, onApply } = props;
    const [sortBy, setSortBy] = useState<SelectSuggestionItem<string>>({
        label: 'Updated At(Desc)',
        value: 'updated_at:desc',
    });
    const [creatorId, setCreatorId] = useState<string | null>(null);

    const fetchUsers = async (query: string) => {
        const result = await adminUsersApi.list({ page: 0, size: 20, search: query });

        return result.values.map((val: UserType) => ({
            value: val._id,
            label: val.name.first + ' ' + val.name.last,
        }));
    };

    return (
        <div className={`side-sheet flex flex-col ${isOpen ? 'open' : ''}`}>
            <div className="side-sheet-header sticky top-0 z-1 flex items-center justify-end py-1.5">
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
                        options={[
                            { value: 'created_at:desc', label: 'Created At (Desc)' },
                            { value: 'created_at:asc', label: 'Created At (Asc)' },
                            { value: 'updated_at:desc', label: 'Updated At (Desc)' },
                            { value: 'updated_at:asc', label: 'Updated At (Asc)' },
                        ]}
                        value={sortBy?.value ?? null}
                        onChange={(val) => {
                            if (val == null) return;
                            const labels: Record<string, string> = {
                                'created_at:desc': 'Created At (Desc)',
                                'created_at:asc': 'Created At (Asc)',
                                'updated_at:desc': 'Updated At (Desc)',
                                'updated_at:asc': 'Updated At (Asc)',
                            };

                            setSortBy({ value: val, label: labels[val] ?? val });
                        }}
                    />
                </div>
                <div className="single-filter flex flex-col gap-2">
                    <span className="text-sm">User</span>
                    <Select<string>
                        placeholder="Search user"
                        variant="ghost"
                        options={fetchUsers}
                        value={creatorId}
                        onChange={(val) => setCreatorId(val)}
                        allowSearch
                        allowDeselect
                    />
                </div>
            </div>
            <div className="side-sheet-footer sticky bottom-0 z-1 mt-auto flex items-center justify-between px-4 py-1.5">
                <Button variant="secondary" size="sm" onClick={onClose}>
                    Close
                </Button>
                <Button
                    size="sm"
                    onClick={() => {
                        onApply(sortBy, creatorId);
                    }}
                >
                    Apply
                </Button>
            </div>
        </div>
    );
};

export default Filters;
