import { SettingsIcon, XIcon } from 'lucide-react';

import { type SelectSuggestionItem } from '@/components';
import { buttonVariants } from '@/components/ui/button';
import Select from '@/components/ui/select';
import { getLucideIcon } from '@/lib/icons/lucide-icons';
import { cn } from '@/lib/utils';

import type { Props } from './parameter-selector.props';
import './parameter-selector.scss';

const ParameterSelector = (props: Props) => {
    const { parameterKey, parameter, parameters, isDarkMode = false, removeParameter, setParameter } = props;

    const handleSelectTrigger = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            if (e.target === e.currentTarget) {
                e.preventDefault();
                const trigger = e.currentTarget.querySelector('button[role="combobox"]') as HTMLButtonElement | null;

                trigger?.click();
            }
        }
    };

    const handleClose = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            removeParameter(parameterKey);
        }
    };

    const maximumOptionLength = Math.max(...parameter.options.map((option) => option.label.length));
    const calculatedMinWidth = Math.min(160, maximumOptionLength * 8 + 32 * 2);
    const minWidthOptions: Array<[number, string]> = [
        [80, 'min-w-[80px]'],
        [96, 'min-w-[96px]'],
        [112, 'min-w-[112px]'],
        [128, 'min-w-[128px]'],
        [144, 'min-w-[144px]'],
    ];
    const minWidthClass =
        minWidthOptions.find(([threshold]) => calculatedMinWidth <= threshold)?.[1] ?? 'min-w-[160px]';
    const ParameterIcon = getLucideIcon(parameter.icon) ?? SettingsIcon;
    const parameterLabel = parameter.label;

    return (
        <div
            className={cn(
                buttonVariants({ variant: isDarkMode ? 'black' : 'outline', size: 'sm' }),
                'selected-parameters rounded-full',
                isDarkMode ? 'dark-mode' : '',
            )}
            tabIndex={0}
            onKeyDown={handleSelectTrigger}
            role="group"
            aria-label={parameterLabel}
        >
            <div
                className="icon-wrapper flex h-6 w-6 items-center justify-center rounded-full"
                onClick={(e) => {
                    e.stopPropagation();
                    removeParameter(parameterKey);
                }}
                onKeyDown={handleClose}
                role="button"
                tabIndex={0}
                aria-label={`Remove ${parameterLabel}`}
            >
                <ParameterIcon className={`globe-icon ${isDarkMode ? 'text-white!' : ''} size-4`} />
                <XIcon className={`xmark-icon ${isDarkMode ? 'text-white!' : ''} size-4`} />
            </div>
            <Select
                value={(parameters[parameterKey] as SelectSuggestionItem<string>)?.value || ''}
                variant={isDarkMode ? 'black' : 'outline'}
                options={parameter.options.map((option) => ({
                    label: option.label,
                    value: option.value,
                }))}
                onChange={(value) => {
                    const selectedOption = parameter.options.find((opt) => String(opt.value) === String(value));

                    setParameter(parameterKey, {
                        label: selectedOption?.label ?? String(value),
                        value: value as string,
                    });
                }}
                allowSearch={false}
                tabIndex={-1}
                triggerLabelClassName={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-primary'}!`}
                triggerChevronIconClassName={`h-4 w-5 flex items-center justify-center text-xs! ${isDarkMode ? 'text-white!' : 'text-primary!'}`}
                popoverClassName={`${minWidthClass} parameter-selector-popover ${isDarkMode ? 'dark-mode' : ''}`}
                triggerAlign="center"
                className="parameter-selector border-transparent bg-transparent p-0 shadow-none"
            />
        </div>
    );
};

export default ParameterSelector;
