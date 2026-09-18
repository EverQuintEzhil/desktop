import { ChevronRightIcon } from 'lucide-react';

import { CopyButton } from '@/components';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { McpServer } from '@/lib/api';
import { cn } from '@/lib/utils';

import { buildRows } from '../utils/build-detail-rows';

interface Props {
    server: McpServer;
}

const ConnectorDetailInfo = ({ server }: Props) => {
    const rows = buildRows(server);

    return (
        <Card className="mt-4 gap-0 border-transparent p-5 shadow-none">
            <Collapsible defaultOpen className="flex flex-col">
                <CollapsibleTrigger
                    className={cn(
                        'group/trigger flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-md text-h5 font-semibold outline-none',
                        'focus-visible:ring-2 focus-visible:ring-(--color-focus-ring)',
                    )}
                >
                    <ChevronRightIcon
                        className="size-4 text-muted-foreground transition-[transform,color] group-hover/trigger:text-foreground group-data-[state=open]/trigger:rotate-90"
                        aria-hidden="true"
                    />
                    <span className="truncate">Connector details</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <dl className="collapsible-content grid gap-x-6 gap-y-4 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:pl-6">
                        {rows.map((row) => (
                            <div
                                key={row.label}
                                className={cn(
                                    'collapsible-content-item flex min-w-0 flex-col gap-0.5 last:min-w-35',
                                    '-mx-2 rounded-md px-2 py-1 transition-colors hover:bg-muted/30',
                                )}
                            >
                                <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
                                <dd className="flex min-w-0 items-center gap-1">
                                    <span
                                        title={row.value}
                                        className={cn(
                                            'min-w-0 truncate text-sm font-medium',
                                            row.isMono && 'font-mono',
                                        )}
                                    >
                                        {row.value}
                                    </span>
                                    {row.canCopy && (
                                        <CopyButton
                                            text={row.value}
                                            className="ml-0! shrink-0 text-muted-foreground hover:text-foreground"
                                            ariaLabel={`Copy ${row.label.toLowerCase()}`}
                                            tooltipContent={`Copy ${row.label.toLowerCase()}`}
                                        />
                                    )}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
};

export default ConnectorDetailInfo;
