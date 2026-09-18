'use client';

import { Avatar as AvatarPrimitive } from 'radix-ui';
import * as React from 'react';
import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

function AvatarRoot({
    className,
    size = 'default',
    ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
    size?: 'default' | 'sm' | 'lg';
}) {
    return (
        <AvatarPrimitive.Root
            data-slot="avatar"
            data-size={size}
            className={cn(
                'avatar group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6',
                className,
            )}
            {...props}
        />
    );
}

function AvatarImageRoot({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
    return (
        <AvatarPrimitive.Image
            data-slot="avatar-image"
            className={cn('aspect-square size-full', className)}
            {...props}
        />
    );
}

function AvatarFallbackRoot({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
    return (
        <AvatarPrimitive.Fallback
            data-slot="avatar-fallback"
            className={cn(
                'flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs',
                className,
            )}
            {...props}
        />
    );
}

function AvatarBadgeRoot({ className, ...props }: React.ComponentProps<'span'>) {
    return (
        <span
            data-slot="avatar-badge"
            className={cn(
                'absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background select-none',
                'group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden',
                'group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2',
                'group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2',
                className,
            )}
            {...props}
        />
    );
}

function AvatarGroupRoot({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="avatar-group"
            className={cn(
                'group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background',
                className,
            )}
            {...props}
        />
    );
}

function AvatarGroupCountRoot({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="avatar-group-count"
            className={cn(
                [
                    'avatar',
                    'bg-muted',
                    'text-muted-foreground',
                    'ring-background',
                    'relative',
                    'flex',
                    'size-8',
                    'shrink-0',
                    'items-center',
                    'justify-center',
                    'rounded-full',
                    'group-has-data-[size=lg]/avatar-group:size-10',
                    'group-has-data-[size=sm]/avatar-group:size-6',
                    '[&>svg]:size-4',
                    'group-has-data-[size=lg]/avatar-group:[&>svg]:size-5',
                    'group-has-data-[size=sm]/avatar-group:[&>svg]:size-3',
                    className,
                ].join(' '),
            )}
            {...props}
        />
    );
}

export interface AvatarProps extends Omit<React.ComponentProps<typeof AvatarRoot>, 'children'> {
    alt?: string;
    initials?: boolean;
    name?: string;
    placeholder?: string;
    src?: string;
    styles?: string;
    srcSet?: string;
    className?: string;
}

function deriveInitialsText(alt: string, name: string): string {
    if (name) return name;

    const words = String(alt).split(' ');

    if (words.length > 1) {
        return `${words[0].charAt(0)}${words[1].charAt(0)}`;
    }
    if (words.length === 1 && words[0].length > 1) {
        return `${words[0].charAt(0)}${words[0].charAt(1)}`;
    }
    if (words.length === 1 && words[0].length === 1) {
        return words[0].charAt(0);
    }

    return '';
}

const Avatar = (props: AvatarProps) => {
    const { alt = '', initials, name = '', placeholder, src, srcSet, styles = '', className, ...rest } = props;

    const [imageError, setImageError] = useState(false);

    const initialsText = useMemo(() => deriveInitialsText(alt, name), [alt, name]);

    const hasSrc = (src && src !== '') || (srcSet && srcSet !== '');
    const showPlaceholder = placeholder && (imageError || !hasSrc);

    const resolvedSrc = showPlaceholder ? placeholder : src;

    return (
        <AvatarRoot
            className={cn(
                'flex items-center justify-center border border-secondary bg-secondary text-secondary-foreground hover:border-accent/80 hover:bg-accent/80',
                className,
            )}
            style={styles ? ({ cssText: styles } as React.CSSProperties) : undefined}
            {...rest}
        >
            {initials ? (
                <span className="text-sm leading-none font-medium text-nowrap text-primary">
                    {initialsText.toUpperCase()}
                </span>
            ) : (
                <>
                    <AvatarImageRoot
                        src={resolvedSrc}
                        srcSet={!showPlaceholder ? srcSet : undefined}
                        alt={alt}
                        className="object-cover"
                        onLoadingStatusChange={(status) => {
                            if (status === 'error') {
                                setImageError(true);
                            }
                        }}
                    />

                    {!placeholder && (
                        <AvatarFallbackRoot className="flex items-center justify-center bg-card text-sm font-medium text-nowrap text-primary">
                            {initialsText.toUpperCase()}
                        </AvatarFallbackRoot>
                    )}
                </>
            )}
        </AvatarRoot>
    );
};

export default Avatar;

export { AvatarRoot, AvatarImageRoot, AvatarFallbackRoot, AvatarBadgeRoot, AvatarGroupRoot, AvatarGroupCountRoot };
