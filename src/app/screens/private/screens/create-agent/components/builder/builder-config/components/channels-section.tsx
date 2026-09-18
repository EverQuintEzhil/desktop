import { MessageSquareIcon, PlusIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import SectionHeading from './section-heading';

export interface ChannelsSectionProps {
    tenantName: string;
    onViewChannel: () => void;
}

const ChannelsSection = ({ tenantName, onViewChannel }: ChannelsSectionProps) => (
    <div className="builder-config-content-channels flex flex-col border-t border-border">
        <SectionHeading
            title="Where people use it"
            technical="Channels"
            subtitle="The places where people can talk to this assistant"
        />
        <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
            <Card
                className={cn(
                    'w-full cursor-pointer rounded-3xl p-4 shadow-none transition-all duration-150 lg:p-6',
                    'hover:bg-(--surface-hover) hover:shadow-surface',
                )}
                role="button"
                tabIndex={0}
                aria-label="Edit chat channel"
                onClick={onViewChannel}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onViewChannel();
                    }
                }}
            >
                <MessageSquareIcon className="size-[22px] text-primary" aria-hidden="true" />
                <div className="mt-3.5 text-sm font-semibold text-(--text-primary)">{tenantName}</div>
                <div className="mt-1 text-[13px] text-text-secondary">People chat with it here</div>
            </Card>
            <div className="w-full rounded-3xl border-[1.5px] border-dashed border-border-secondary p-4 text-text-secondary lg:p-6">
                <PlusIcon className="size-[22px] text-primary" aria-hidden="true" />
                <div className="mt-3.5 text-sm font-medium">Add another place</div>
                <div className="mt-1 text-[13px]">Coming soon</div>
            </div>
        </div>
    </div>
);

export default ChannelsSection;
