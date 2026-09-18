import { LoaderCircleIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Shadcn Spinner primitive — circular Lucide icon with `animate-spin`.
 * Useful as a lightweight inline loading indicator.
 */
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
    return (
        <LoaderCircleIcon
            role="status"
            aria-label="Loading"
            className={cn('size-4 animate-spin', className)}
            {...props}
        />
    );
}

export interface SpinnerBladeProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Legacy inline-CSS string forwarded to the wrapper (matches original `styles` prop) */
    styles?: string;
}

/**
 * Drop-in replacement for the custom `Spinner` component.
 *
 * Renders 8 blades arranged in a circle, each fading in/out with staggered
 * animation delays — identical to the original styled-component implementation.
 *
 * Props are a superset of `HTMLDivElement` attributes.
 *
 * Deliberately carries no `role="status"`: most usages sit inside a button that
 * already has its own accessible name, where a nested live region is redundant
 * and inconsistently handled. Callers that render it as a standalone page-level
 * loading state should pass `role="status"` and a label themselves.
 */
function SpinnerBlade({ styles, className, ...rest }: SpinnerBladeProps) {
    return (
        <>
            <style>
                {`
                @keyframes SpinnerBlade {
                    0%   { opacity: 0.85; }
                    50%  { opacity: 0.25; }
                    100% { opacity: 0.25; }
                }
            `}
            </style>

            <div
                className={cn('spinner relative', className)}
                style={{
                    width: 20,
                    height: 20,
                    ...(styles ? ({ cssText: styles } as React.CSSProperties) : {}),
                }}
                {...rest}
            >
                {[
                    { rotate: 45, delay: '-1.625s' },
                    { rotate: 90, delay: '-1.5s' },
                    { rotate: 135, delay: '-1.375s' },
                    { rotate: 180, delay: '-1.25s' },
                    { rotate: 225, delay: '-1.125s' },
                    { rotate: 270, delay: '-1s' },
                    { rotate: 315, delay: '-0.875s' },
                    { rotate: 360, delay: '-0.75s' },
                ].map(({ rotate, delay }, i) => (
                    <div
                        key={i}
                        className="blade absolute"
                        style={{
                            top: 6.5,
                            left: 8.5,
                            width: 2.5,
                            height: 6.5,
                            backgroundColor: 'currentColor',
                            borderRadius: 9999,
                            transform: `rotate(${rotate}deg) translateY(-6.5px)`,
                            animation: 'SpinnerBlade 1s linear infinite',
                            animationDelay: delay,
                            willChange: 'opacity',
                        }}
                    />
                ))}
            </div>
        </>
    );
}

SpinnerBlade.displayName = '@dls/Spinner';

export { Spinner, SpinnerBlade };
export default SpinnerBlade;
