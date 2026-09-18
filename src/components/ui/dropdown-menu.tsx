import { CheckIcon, ChevronDownIcon, ChevronRightIcon, CircleIcon, type LucideIcon } from 'lucide-react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import * as React from 'react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import './dropdown-menu.scss';

function DropdownMenuRoot({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
    return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
    return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
    return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
    className,
    sideOffset = 4,
    collisionPadding = 8,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
    return (
        <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
                data-slot="dropdown-menu-content"
                sideOffset={sideOffset}
                collisionPadding={collisionPadding}
                className={cn(
                    'scrollbar-controller scrollbar-vertical z-51 min-w-[8rem] overflow-x-hidden bg-popover text-popover-foreground',
                    'rounded-xl border p-1 shadow-surface dark:border-(--neutral-border)',
                    'max-h-(--radix-dropdown-menu-content-available-height)',
                    'origin-(--radix-dropdown-menu-content-transform-origin)',
                    'data-[state=closed]:animate-out data-[state=open]:animate-in',
                    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                    'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                    'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
                    'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
                    className,
                )}
                {...props}
            />
        </DropdownMenuPrimitive.Portal>
    );
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
    return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuItem({
    className,
    inset,
    variant = 'default',
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    variant?: 'default' | 'destructive';
}) {
    return (
        <DropdownMenuPrimitive.Item
            data-slot="dropdown-menu-item"
            data-inset={inset}
            data-variant={variant}
            className={cn(
                'dropdown-menu-item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                'outline-hidden select-none',
                'focus:bg-accent focus:text-accent-foreground',
                'data-disabled:pointer-events-none data-disabled:opacity-50',
                'data-inset:pl-8',
                'data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10',
                'dark:data-[variant=destructive]:focus:bg-destructive/20',
                'data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:text-destructive!',
                "[&_svg:not([class*='text-'])]:text-muted-foreground",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
        />
    );
}

function DropdownMenuCheckboxItem({
    className,
    children,
    checked,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
    return (
        <DropdownMenuPrimitive.CheckboxItem
            data-slot="dropdown-menu-checkbox-item"
            className={cn(
                'relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm',
                'outline-hidden select-none',
                'focus:bg-accent focus:text-accent-foreground',
                'data-disabled:pointer-events-none data-disabled:opacity-50',
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            checked={checked}
            {...props}
        >
            <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
                <DropdownMenuPrimitive.ItemIndicator>
                    <CheckIcon className="size-4" />
                </DropdownMenuPrimitive.ItemIndicator>
            </span>
            {children}
        </DropdownMenuPrimitive.CheckboxItem>
    );
}

function DropdownMenuRadioGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
    return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
    className,
    children,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
    return (
        <DropdownMenuPrimitive.RadioItem
            data-slot="dropdown-menu-radio-item"
            className={cn(
                'relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm',
                'outline-hidden select-none',
                'focus:bg-accent focus:text-accent-foreground',
                'data-disabled:pointer-events-none data-disabled:opacity-50',
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
        >
            <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
                <DropdownMenuPrimitive.ItemIndicator>
                    <CircleIcon className="size-2 fill-current" />
                </DropdownMenuPrimitive.ItemIndicator>
            </span>
            {children}
        </DropdownMenuPrimitive.RadioItem>
    );
}

function DropdownMenuLabel({
    className,
    inset,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
}) {
    return (
        <DropdownMenuPrimitive.Label
            data-slot="dropdown-menu-label"
            data-inset={inset}
            className={cn('px-2 py-1.5 text-sm font-medium data-inset:pl-8', className)}
            {...props}
        />
    );
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
    return (
        <DropdownMenuPrimitive.Separator
            data-slot="dropdown-menu-separator"
            className={cn('-mx-1 my-1 h-px bg-border', className)}
            {...props}
        />
    );
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
    return (
        <span
            data-slot="dropdown-menu-shortcut"
            className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)}
            {...props}
        />
    );
}

function DropdownMenuSub({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
    return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
    className,
    inset,
    children,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
}) {
    return (
        <DropdownMenuPrimitive.SubTrigger
            data-slot="dropdown-menu-sub-trigger"
            data-inset={inset}
            className={cn(
                'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                'outline-hidden select-none data-inset:pl-8',
                'focus:bg-accent focus:text-accent-foreground',
                'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
                "[&_svg:not([class*='text-'])]:text-muted-foreground",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
        >
            {children}
            <ChevronRightIcon className="ml-auto size-4" />
        </DropdownMenuPrimitive.SubTrigger>
    );
}

function DropdownMenuSubContent({
    className,
    collisionPadding = 8,
    ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
    return (
        <DropdownMenuPrimitive.SubContent
            data-slot="dropdown-menu-sub-content"
            collisionPadding={collisionPadding}
            className={cn(
                'z-51 min-w-[8rem] rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg dark:border-(--neutral-border)',
                'max-h-(--radix-dropdown-menu-content-available-height)',
                'max-w-(--radix-dropdown-menu-content-available-width)',
                'scrollbar-controller scrollbar-vertical overflow-x-hidden',
                'origin-(--radix-dropdown-menu-content-transform-origin)',
                'data-[state=closed]:animate-out data-[state=open]:animate-in',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
                'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
                className,
            )}
            {...props}
        />
    );
}

export {
    DropdownMenuRoot,
    DropdownMenuPortal,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
};

export interface DropdownMenuOption {
    label: ReactNode;
    value?: string;
    icon?: LucideIcon;
    onClick?: () => void;
    disabled?: boolean;
}

export interface DropdownMenuProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    triggerText?: ReactNode;
    trigger?: ReactNode;
    options: DropdownMenuOption[];
    triggerClassName?: string;
    contentClassName?: string;
    itemClassName?: string;
    align?: 'start' | 'center' | 'end';
    side?: 'top' | 'right' | 'bottom' | 'left';
    sideOffset?: number;
}

export type DropDownValueObject<T> = {
    label?: string;
    key?: string;
    icon?: LucideIcon;
    iconProps?: React.ComponentProps<LucideIcon>;
    onClick?: (event: React.MouseEvent) => void;
    value: T;
};

const DropdownMenu = ({
    open,
    onOpenChange,
    triggerText,
    trigger,
    options,
    triggerClassName,
    contentClassName,
    itemClassName,
    align = 'end',
    side = 'bottom',
    sideOffset = 4,
}: DropdownMenuProps) => {
    return (
        <DropdownMenuPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                {trigger ? (
                    trigger
                ) : (
                    <Button
                        variant="ghost"
                        className={cn(
                            'gap-1 rounded-full font-medium text-primary hover:bg-primary/10 hover:text-primary',
                            triggerClassName,
                        )}
                    >
                        {triggerText}
                        <ChevronDownIcon className="h-4 w-4" />
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className={cn(
                    'w-56 rounded-xl border border-border bg-popover p-1 shadow-lg dark:border-(--neutral-border)',
                    contentClassName,
                )}
                align={align}
                side={side}
                sideOffset={sideOffset}
            >
                {options.map((option, index) => (
                    <DropdownMenuItem
                        key={option.value || String(index)}
                        onClick={option.onClick}
                        disabled={option.disabled}
                        className={cn(
                            'dropdown-menu-item cursor-pointer rounded-md p-2 text-foreground hover:bg-background',
                            itemClassName,
                        )}
                    >
                        {option.icon ? <option.icon className="h-4 w-4" /> : null}
                        <span>{option.label}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenuPrimitive.Root>
    );
};

export { DropdownMenu };

/* DropDown — a generic, API-compatible replacement for the previous drop_down component */

export interface DropDownProps<T> {
    list: Array<DropDownValueObject<T>>;
    placeholder?: string;
    selectedOptions?: Array<DropDownValueObject<T>>;
    onSelect: (value: DropDownValueObject<T>) => void;
    trim?: boolean;
    leftIcon?: LucideIcon;
    leftIconProps?: React.ComponentProps<LucideIcon>;
    renderContent?: (props: { isOpen: boolean }) => React.ReactNode;
    renderItem?: (option: DropDownValueObject<T>) => React.ReactNode;
    className?: string;
    contentClassName?: string;
    itemClassName?: string;
    open?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
    onOpen?: () => void;
    onClose?: () => void;
    align?: 'start' | 'center' | 'end';
    side?: 'top' | 'right' | 'bottom' | 'left';
    sideOffset?: number;
    modal?: boolean;
}

const DropDown = <T,>(props: DropDownProps<T>) => {
    const {
        list,
        placeholder,
        trim = true,
        selectedOptions,
        onSelect,
        leftIcon,
        leftIconProps,
        renderContent,
        renderItem,
        className,
        contentClassName,
        itemClassName,
        open: controlledOpen,
        onOpenChange,
        onOpen,
        onClose,
        align = 'end',
        side = 'bottom',
        sideOffset = 4,
        modal,
    } = props;

    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
    const isControlled = typeof controlledOpen === 'boolean';
    const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

    const handleOpenChange = (nextOpen: boolean) => {
        if (!isControlled) {
            setUncontrolledOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
        if (nextOpen) {
            onOpen?.();
        } else {
            onClose?.();
        }
    };

    const handleSelect = (option: DropDownValueObject<T>) => {
        handleOpenChange(false);
        onSelect(option);
    };

    const selectedKeys = selectedOptions?.map((o) => o.key) ?? [];
    const LeftIcon = leftIcon;

    return (
        <DropdownMenuPrimitive.Root open={isOpen} onOpenChange={handleOpenChange} modal={modal}>
            <DropdownMenuTrigger asChild>
                {renderContent ? (
                    <div className={className}>{renderContent({ isOpen })}</div>
                ) : (
                    <button
                        type="button"
                        className={cn(
                            'inline-flex items-center justify-between gap-2 rounded-xl border border-border-secondary',
                            'h-9 w-full cursor-pointer px-3.5 text-sm',
                            'hover:bg-background hover:text-primary',
                            'focus:outline-none',
                            isOpen && 'shadow-xs',
                            className,
                        )}
                    >
                        {LeftIcon ? <LeftIcon className="mr-2" {...(leftIconProps || {})} /> : null}
                        <span className="text-sm">{placeholder || 'Actions'}</span>
                        <ChevronDownIcon className="size-4" />
                    </button>
                )}
            </DropdownMenuTrigger>

            <DropdownMenuContent
                className={cn(
                    'scrollbar-controller scrollbar-vertical max-h-[205px] min-w-[100px] rounded-xl border border-background bg-popover p-2 shadow-xs',
                    contentClassName,
                )}
                align={align}
                side={side}
                sideOffset={sideOffset}
            >
                {list.map((option) => {
                    const isSelected = selectedKeys.includes(option.key);

                    return (
                        <DropdownMenuItem
                            key={option.key || option.label}
                            onClick={(e) => {
                                option.onClick?.(e);
                                handleSelect(option);
                            }}
                            className={cn(
                                'cursor-pointer rounded-lg p-2 text-foreground',
                                'hover:bg-background hover:text-primary hover:[&_i]:text-primary hover:[&_span]:text-primary',
                                trim && 'truncate',
                                isSelected && 'bg-background text-primary [&_i]:text-primary [&_span]:text-primary',
                                itemClassName,
                            )}
                        >
                            {renderItem ? (
                                renderItem(option)
                            ) : (
                                <>
                                    {option.icon && <option.icon {...(option.iconProps || {})} />}
                                    <span className="text-sm">{option.label}</span>
                                </>
                            )}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenuPrimitive.Root>
    );
};

DropDown.displayName = '@ui/DropDown';

export { DropDown };
