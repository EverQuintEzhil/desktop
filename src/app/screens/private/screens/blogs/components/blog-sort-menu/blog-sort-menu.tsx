import { ArrowUpDownIcon, CheckIcon } from 'lucide-react';

import { DropdownMenu } from '@/components';

import { BLOG_FILTER_ITEM_CLASS, BLOG_FILTER_TRIGGER_CLASS, type BlogSortOption } from '../../constants';

export interface BlogSortMenuProps {
    value: string;
    options: BlogSortOption[];
    onChange: (value: string) => void;
}

const BlogSortMenu = (props: BlogSortMenuProps) => {
    const { value, options, onChange } = props;
    const selected = options.find((option) => option.value === value);

    return (
        <DropdownMenu
            triggerClassName={`blog-sort-menu ${BLOG_FILTER_TRIGGER_CLASS}`}
            itemClassName={BLOG_FILTER_ITEM_CLASS}
            contentClassName="min-w-[200px]"
            triggerText={
                <span className="flex items-center gap-2">
                    <ArrowUpDownIcon className="size-3.5" />
                    {selected?.label ?? 'Sort'}
                </span>
            }
            options={options.map((option) => ({
                label: (
                    <span className="flex items-center justify-between gap-4">
                        <span>{option.label}</span>
                        {option.value === value ? <CheckIcon className="size-3.5 shrink-0 text-primary" /> : null}
                    </span>
                ),
                value: option.value,
                onClick: () => onChange(option.value),
            }))}
        />
    );
};

export default BlogSortMenu;
