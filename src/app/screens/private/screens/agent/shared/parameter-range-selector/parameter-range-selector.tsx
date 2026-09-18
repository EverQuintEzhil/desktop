import { SettingsIcon, XIcon } from 'lucide-react';
import React from 'react';

import Stepper from '@/app/components/stepper';
import { type SelectSuggestionItem } from '@/components';
import { buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getLucideIcon } from '@/lib/icons/lucide-icons';
import { cn } from '@/lib/utils';

import type { Props } from './parameter-range-selector.props';
import './parameter-range-selector.scss';

const ParameterRangeSelector = (props: Props) => {
    const { parameterKey, parameter, parameters, isDarkMode = false, removeParameter, setParameter } = props;

    const getParameterValue = (key: string, defaultValue: number): number => {
        if (typeof parameters[key] === 'number') {
            return parameters[key] as number;
        }
        if (typeof (parameters[key] as SelectSuggestionItem<string>)?.value === 'string') {
            return Number((parameters[key] as SelectSuggestionItem<string>).value);
        }

        return defaultValue;
    };

    const handleSelectTrigger = (e: React.KeyboardEvent<HTMLDivElement | HTMLButtonElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            if (e.target === e.currentTarget) {
                e.preventDefault();
                setIsPopoverOpen(true);
            }
        }
    };

    const handleRemoveParameter = (e: React.KeyboardEvent<HTMLDivElement | HTMLButtonElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            removeParameter(parameterKey);
        }
    };

    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
    const ParameterIcon = getLucideIcon(parameter.icon) ?? SettingsIcon;
    const parameterLabel = parameter.label;

    return (
        <div
            className={cn(
                buttonVariants({ variant: isDarkMode ? 'black' : 'outline', size: 'sm' }),
                'selected-parameters range-parameter gap-0 rounded-full',
                isDarkMode ? 'dark-mode' : '',
            )}
            tabIndex={0}
            onKeyDown={handleSelectTrigger}
            role="group"
            aria-label={parameterLabel}
        >
            <div
                className="icon-wrapper flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                onClick={() => {
                    removeParameter(parameterKey);
                }}
                onKeyDown={handleRemoveParameter}
                role="button"
                tabIndex={0}
                aria-label={`Remove ${parameterLabel}`}
            >
                <ParameterIcon className="globe-icon size-4" />
                <XIcon className="xmark-icon size-4" />
            </div>
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                    <div
                        className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-primary'} flex min-h-[30px] items-center pr-1.5 pl-1.5 text-left focus:outline-none`}
                        role="button"
                        tabIndex={-1}
                    >
                        {getParameterValue(parameterKey, parameter.default)}
                    </div>
                </PopoverTrigger>
                <PopoverContent
                    sideOffset={4}
                    align="center"
                    side="bottom"
                    className={`stepper-popover-content w-auto min-w-[100px] ${isDarkMode ? 'dark-mode border-0 p-0' : 'bg-popover p-2'}`}
                >
                    <div className="popover-inner">
                        <Stepper
                            value={getParameterValue(parameterKey, parameter.default)}
                            min={parameter.range.min}
                            max={parameter.range.max}
                            step={parameter.range.step}
                            isDarkMode={isDarkMode}
                            onChange={(newValue) => {
                                setParameter(parameterKey, newValue);
                            }}
                        />
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export default ParameterRangeSelector;
