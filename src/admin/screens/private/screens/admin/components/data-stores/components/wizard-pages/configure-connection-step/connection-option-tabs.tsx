import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { type ConnectionProviderOption, connectionGetOptionLabel } from './connection-utils';

interface ConnectionOptionTabsProps {
    options: ConnectionProviderOption[];
    activeIndex: number;
    onChange: (index: number) => void;
    className?: string;
}

export const ConnectionOptionTabs = ({ options, activeIndex, onChange, className }: ConnectionOptionTabsProps) => {
    if (options.length <= 1) {
        return null;
    }

    return (
        <Tabs
            value={String(activeIndex)}
            onValueChange={(value) => onChange(Number(value))}
            className={cn('gap-0', className)}
        >
            <TabsList variant="line" className="h-7! gap-3 p-0">
                {options.map((option, index) => (
                    <TabsTrigger
                        key={index}
                        value={String(index)}
                        className={cn(
                            'h-7 px-0 text-text-secondary',
                            'after:bg-primary group-data-[orientation=horizontal]/tabs:after:bottom-0',
                            'data-[state=active]:bg-primary/10 data-[state=active]:text-primary',
                        )}
                    >
                        {connectionGetOptionLabel(option, index)}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
};
