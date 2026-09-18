import { StarIcon } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';
import Tag from '@/components/ui/tag';

import { tagSuggestionValuesEqual } from './tag-suggestion-utils';
import { type RenderTagsProps } from './tags-input.types';

const RenderTags = <T,>({
    tags = [],
    removable,
    onRemove,
    tagProps,
    size = 'regular',
    defaultItemValue,
    onDefaultItemChange,
    showDefaultItemStar = false,
    defaultItemLoading,
}: RenderTagsProps<T>) =>
    tags.map((tag, index: number) => {
        const hasDefaultItemValue = typeof defaultItemValue !== 'undefined';
        const isDefaultItem =
            hasDefaultItemValue &&
            (Array.isArray(defaultItemValue)
                ? defaultItemValue.some((val) => tagSuggestionValuesEqual(tag.value, val))
                : tagSuggestionValuesEqual(tag.value, defaultItemValue));
        const shouldRenderDefaultStar = showDefaultItemStar;
        const shouldShowDefaultItemLoader = defaultItemLoading && isDefaultItem;

        return (
            <Tag
                {...tagProps}
                {...tag}
                key={`tag-${tag.value}-${index}`}
                value={tag.value}
                label={tag.label}
                removable={typeof tag.removable !== 'undefined' ? tag.removable : removable}
                selectable={Boolean(onDefaultItemChange) || tagProps?.selectable}
                selected={isDefaultItem || tagProps?.selected}
                icon={shouldRenderDefaultStar && !shouldShowDefaultItemLoader ? StarIcon : tagProps?.icon}
                iconSlot={
                    shouldShowDefaultItemLoader ? <Spinner className="size-3.5 text-amber-500" /> : tagProps?.iconSlot
                }
                iconProps={{
                    ...(shouldRenderDefaultStar
                        ? {
                              className: `${isDefaultItem ? 'text-amber-500' : ''} size-3.5`,
                              fill: isDefaultItem ? 'currentColor' : 'none',
                          }
                        : {}),
                    ...tagProps?.iconProps,
                }}
                rightIcon={tagProps?.rightIcon}
                rightIconSlot={tagProps?.rightIconSlot}
                rightIconProps={tagProps?.rightIconProps}
                size={size}
                onRemove={() => onRemove(index)}
                onSelect={(_, selected) => {
                    onDefaultItemChange?.(tag, selected);
                    tagProps?.onSelect?.(tag.value, selected);
                }}
            />
        );
    });

export default RenderTags;
