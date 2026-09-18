import type { LucideIcon } from 'lucide-react';
import React from 'react';

import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import './switch-shared.scss';

interface SwitchOption {
    label: string;
    icon?: LucideIcon;
}

export type SwitchWidth = number | { xs?: number; sm?: number; md?: number; default?: number };

export type RemoveLabelMobileProp = boolean | { xs?: boolean; sm?: boolean; md?: boolean };

interface SwitchProps {
    options: SwitchOption[];
    activeIndex: number;
    onChange: (event: React.MouseEvent, index: number) => void;
    isLoading?: boolean;
    color?: 'primary' | 'white';
    className?: string;
    width?: SwitchWidth;
    disabled?: boolean;
    removeLabelMobile?: RemoveLabelMobileProp;
    showTooltip?: boolean;
    tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
}

const getRemoveLabelMobileClass = (removeLabelMobile: RemoveLabelMobileProp): string => {
    if (removeLabelMobile === true) return 'hide-label-mobile-sm';
    if (typeof removeLabelMobile === 'object') {
        return [
            removeLabelMobile.xs && 'hide-label-mobile-xs',
            removeLabelMobile.sm && 'hide-label-mobile-sm',
            removeLabelMobile.md && 'hide-label-mobile-md',
        ]
            .filter(Boolean)
            .join(' ');
    }

    return '';
};

const Switch = (props: SwitchProps) => {
    const {
        options,
        activeIndex,
        onChange,
        isLoading = false,
        color = 'primary',
        className = '',
        width = 92 as SwitchWidth,
        disabled = false,
        removeLabelMobile = false as RemoveLabelMobileProp,
        showTooltip = false,
        tooltipSide = 'bottom',
    } = props;

    const defaultWidth = typeof width === 'number' ? width : (width?.default ?? 92);

    const cssVars = {
        '--switch-width-default': `${defaultWidth}px`,
        '--switch-active-index': String(activeIndex),
        ...(typeof width === 'object' && width.xs != null && { '--switch-width-xs': `${width.xs}px` }),
        ...(typeof width === 'object' && width.sm != null && { '--switch-width-sm': `${width.sm}px` }),
        ...(typeof width === 'object' && width.md != null && { '--switch-width-md': `${width.md}px` }),
    } as React.CSSProperties;

    const widthClasses =
        typeof width === 'object'
            ? [
                  width.xs != null && 'switch--width-xs',
                  width.sm != null && 'switch--width-sm',
                  width.md != null && 'switch--width-md',
              ]
                  .filter(Boolean)
                  .join(' ')
            : '';

    return (
        <ToggleGroup
            type="single"
            value={String(activeIndex)}
            onValueChange={() => {}}
            className={cn(
                'switch rounded-pill',
                `switch--color-${color}`,
                widthClasses,
                getRemoveLabelMobileClass(removeLabelMobile),
                isLoading && 'cursor-not-allowed',
                className,
            )}
            style={cssVars}
            onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
            }}
        >
            <div className="active-indicator" aria-hidden />
            {options.map((option, index) => (
                <SimpleTooltip
                    key={`${option.label}-${index}`}
                    content={option.label}
                    side={tooltipSide}
                    disabled={!showTooltip}
                >
                    <ToggleGroupItem
                        value={String(index)}
                        aria-label={option.label}
                        disabled={isLoading || disabled}
                        className={cn(
                            'switch-item gap-2 rounded-full border-0 bg-transparent px-2 shadow-none',
                            'data-[state=on]:bg-transparent data-[state=on]:shadow-none',
                            'hover:bg-transparent',
                            'focus-visible:border-0 focus-visible:ring-[1.5px] focus-visible:outline-none',
                            activeIndex === index
                                ? 'active focus-visible:ring-white'
                                : 'focus-visible:ring-(--color-focus-ring)',
                            !isLoading && activeIndex !== index && 'cursor-pointer',
                        )}
                        onClick={(event) => {
                            if (!isLoading && index !== activeIndex) {
                                onChange(event, index);
                            }
                        }}
                    >
                        {option.icon ? <option.icon /> : null}
                        <span className={cn('text-sm', removeLabelMobile && 'hide-label-mobile')}>{option.label}</span>
                    </ToggleGroupItem>
                </SimpleTooltip>
            ))}
        </ToggleGroup>
    );
};

export default Switch;
