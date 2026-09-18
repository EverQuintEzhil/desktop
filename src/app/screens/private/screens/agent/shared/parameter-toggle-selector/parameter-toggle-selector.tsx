import { SettingsIcon, XIcon } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { getLucideIcon } from '@/lib/icons/lucide-icons';
import { cn } from '@/lib/utils';
import type { ParameterTypeToggle } from '@/types/admin';

interface Props {
    parameterKey: string;
    parameter: ParameterTypeToggle & { label: string };
    isDarkMode?: boolean;
    removeParameter: (key: string) => void;
}

const ParameterToggleSelector = ({ parameterKey, parameter, isDarkMode = false, removeParameter }: Props) => {
    const ParameterIcon = getLucideIcon(parameter.icon) ?? SettingsIcon;

    return (
        <div
            className={cn(
                buttonVariants({ variant: isDarkMode ? 'black' : 'outline', size: 'sm' }),
                'selected-parameters gap-1.5 rounded-full',
                isDarkMode ? 'dark-mode' : '',
            )}
        >
            <div
                className="icon-wrapper flex h-6 w-6 cursor-pointer items-center justify-center rounded-full"
                onClick={(e) => {
                    e.stopPropagation();
                    removeParameter(parameterKey);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        removeParameter(parameterKey);
                    }
                }}
            >
                <ParameterIcon className={`globe-icon ${isDarkMode ? 'text-white!' : ''} size-4`} />
                <XIcon className={`xmark-icon ${isDarkMode ? 'text-white!' : ''} size-4`} />
            </div>
            <span className={cn('px-1 text-xs font-medium', isDarkMode ? 'text-white' : 'text-primary')}>
                {parameter.label}
            </span>
        </div>
    );
};

export default ParameterToggleSelector;
