import { cva } from 'class-variance-authority';
import { PenIcon, type LucideIcon, StarIcon, XIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const tagVariants = cva('inline-flex cursor-default items-center justify-center gap-2 break-all transition-colors', {
    variants: {
        size: {
            small: 'min-h-7 px-2 py-0.5 text-xs',
            regular: 'min-h-8 px-3 py-1 text-sm',
            large: 'min-h-10 px-3 py-1.5 text-base',
        },
        variant: {
            rounded: 'rounded-sm',
            roundedCircle: 'rounded-full',
            pill: 'rounded-3xl',
        },
        selected: {
            true: 'bg-background text-primary hover:bg-background/50',
            false: 'bg-muted text-foreground hover:bg-background',
        },
        iconOnly: {
            true: 'justify-center border-0 p-0',
            false: '',
        },
    },
    compoundVariants: [
        { iconOnly: true, size: 'small', class: 'size-6' },
        { iconOnly: true, size: 'regular', class: 'size-8' },
        { iconOnly: true, size: 'large', class: 'size-10' },
    ],
    defaultVariants: {
        size: 'regular',
        variant: 'rounded',
        selected: false,
        iconOnly: false,
    },
});

export interface TagProps<T = string | number | object | null> extends Omit<
    React.HTMLProps<HTMLDivElement>,
    'value' | 'onSelect' | 'size'
> {
    /** Text label */
    label?: string;
    /** Called with `value` when the remove icon is clicked */
    onRemove?: (item: T) => void;
    /** Called with `value` when the edit icon is clicked */
    onEdit?: (item: T) => void;
    /** Called with `(value, newSelectedState)` on click (selectable mode) */
    onSelect?: (item: T, selected: boolean) => void;
    /** Show remove (×) icon */
    removable?: boolean;
    /** Show edit (pen) icon */
    editable?: boolean;
    /** Enable selectable toggle behaviour */
    selectable?: boolean;
    /** Controlled selected state */
    selected?: boolean;
    /** Left icon name */
    icon?: LucideIcon;
    /** Props forwarded to the left Icon */
    iconProps?: React.ComponentProps<LucideIcon>;
    /** Custom content rendered in the left icon position */
    iconSlot?: React.ReactNode;
    /** Right icon name */
    rightIcon?: LucideIcon;
    /** Props forwarded to the right Icon */
    rightIconProps?: React.ComponentProps<LucideIcon>;
    /** Custom content rendered in the right icon position */
    rightIconSlot?: React.ReactNode;
    /** Show a filled star when the tag is selected */
    showStarOnSelected?: boolean;
    /** Size variant */
    size?: 'small' | 'regular' | 'large';
    /** Shape variant */
    variant?: 'rounded' | 'roundedCircle' | 'pill';
    /** Custom children (overrides label) */
    children?: React.ReactNode;
    /** Generic value passed back to callbacks */
    value?: T;
}

/**
 * Shadcn-based drop-in replacement for the custom `Tag` component.
 *
 * Uses CVA variants (similar to shadcn Badge) for size, shape, selected state,
 * and icon-only mode. Supports the full original API: removable, editable,
 * selectable, icons, generics, and previous `styles` prop.
 */
function Tag<T>({
    disabled,
    id,
    label,
    children,
    onClick,
    onRemove,
    onEdit,
    onSelect,
    editable,
    removable,
    selectable,
    selected = false,
    value,
    icon: leftIcon,
    iconProps: leftIconProps = {},
    iconSlot,
    rightIcon,
    rightIconProps = {},
    rightIconSlot,
    showStarOnSelected,
    size = 'regular',
    variant = 'rounded',
    className,
    ...rest
}: TagProps<T>) {
    const isIconOnly = !!(leftIcon || iconSlot || rightIcon || rightIconSlot) && !children && !label;

    // ── Render helpers ──

    const renderIcon = (IconComponent?: LucideIcon, iconProps: React.ComponentProps<LucideIcon> = {}) =>
        IconComponent ? <IconComponent {...iconProps} /> : null;

    const renderRemove = () =>
        removable ? (
            <XIcon
                className="size-4 cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove?.(value as T);
                }}
            />
        ) : null;

    const renderEdit = () =>
        editable ? (
            <PenIcon
                className="size-4 cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(value as T);
                }}
            />
        ) : null;

    const renderSelectedStar = () => <StarIcon aria-hidden className="size-3.5 text-amber-500" fill="currentColor" />;

    const renderLeftIcon = () => {
        const leftContent = iconSlot ?? renderIcon(leftIcon, leftIconProps);

        if (showStarOnSelected && selected) {
            if (!leftContent) return renderSelectedStar();

            return (
                <span className="inline-flex items-center gap-1.5">
                    {renderSelectedStar()}
                    {leftContent}
                </span>
            );
        }

        return leftContent;
    };

    const renderRightIcon = () => {
        const rightContent = rightIconSlot ?? renderIcon(rightIcon, rightIconProps);

        return rightContent;
    };

    const renderLabel = () => {
        if (children) return children;
        if (label) return <>{label}</>;

        return null;
    };

    // ── Common classes ──

    const classes = cn(
        tagVariants({
            size,
            variant,
            selected,
            iconOnly: isIconOnly,
        }),
        'tags',
        selectable && 'selectable-tag',
        selectable && 'cursor-pointer',
        disabled && 'cursor-not-allowed opacity-65 **:cursor-not-allowed',
        className,
    );

    // ── Selectable mode ──

    if (selectable) {
        return (
            <div
                {...rest}
                id={id}
                className={classes}
                onClick={(e) => {
                    if (!disabled) {
                        onSelect?.(value as T, !selected);
                        onClick?.(e);
                    }
                }}
                role="option"
                aria-selected={selected}
                tabIndex={disabled ? -1 : 0}
                onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                        e.preventDefault();
                        onSelect?.(value as T, !selected);
                    }
                }}
            >
                {renderLeftIcon()}
                {renderLabel()}
                {renderRightIcon()}
                {renderRemove()}
            </div>
        );
    }

    return (
        <div {...rest} id={id} className={classes}>
            {renderLeftIcon()}
            {renderLabel()}
            {renderRightIcon()}
            {renderEdit()}
            {renderRemove()}
        </div>
    );
}

export { Tag, tagVariants };
export default Tag;
