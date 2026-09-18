import { InfoIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { buildParameterFieldDocs } from './parameter-schema-docs';
import type { ParameterFieldDocRow, ToolParameterSchema } from './tool-parameter-schema.types';

interface ParameterSchemaInfoTriggerProps {
    title?: string;
    description?: string;
    toolParameters: ToolParameterSchema | undefined;
    disabled?: boolean;
    className?: string;
}

const renderIntro = (hasRows: boolean, description?: string) => {
    if (hasRows) {
        return (
            <p className="text-sm text-muted-foreground">
                {description ??
                    `The parameters is validated against the tool parameter schema. Each field below lists
                constraints and a small example that satisfies the schema when possible.`}
            </p>
        );
    }

    return (
        <p className="text-sm text-muted-foreground">
            No parameter schema is configured for this tool, so only basic JSON object validation applies. If your tool
            defines parameters later, details will appear here.
        </p>
    );
};

const renderFieldRows = (rows: ParameterFieldDocRow[]) => (
    <div className="scrollbar-controller scrollbar-vertical flex max-h-[min(60vh,480px)] flex-col gap-3 pr-1">
        {rows.map((row) => (
            <div
                key={row.path}
                className={cn('rounded-md border border-border bg-(--bg-primary) p-3', 'space-y-2 text-sm')}
            >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <code className="text-xs font-medium break-all text-(--text-primary)">{row.path}</code>
                    <span className="text-xs text-muted-foreground">{row.typeLabel}</span>
                </div>
                {row.constraints.length > 0 && (
                    <ul className="list-inside list-disc space-y-0.5 text-xs text-text-secondary">
                        {row.constraints.map((line, idx) => (
                            <li key={`${idx}-${line}`}>{line}</li>
                        ))}
                    </ul>
                )}
                <div>
                    <span className="text-xs font-medium text-text-secondary">Example</span>
                    <pre
                        className={cn(
                            'scrollbar-controller scrollbar-vertical scrollbar-horizontal mt-1 max-h-32 rounded border border-border-secondary',
                            'bg-muted/40 p-2 text-xs break-all whitespace-pre-wrap',
                        )}
                    >
                        {row.exampleJson}
                    </pre>
                </div>
            </div>
        ))}
    </div>
);

const ParameterSchemaInfoTrigger = ({
    title,
    description,
    toolParameters,
    disabled,
    className,
}: ParameterSchemaInfoTriggerProps) => {
    const [open, setOpen] = useState(false);
    const rows = buildParameterFieldDocs(toolParameters);
    const hasRows = rows.length > 0;

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
    };

    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('size-7 shrink-0 text-muted-foreground', className)}
                disabled={disabled}
                aria-label="Parameter schema details and examples"
                onClick={() => {
                    setOpen(true);
                }}
            >
                <InfoIcon className="size-4" />
            </Button>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden sm:max-w-lg">
                    <DialogHeader className="flex-row items-center justify-between">
                        <DialogTitle>{title ?? 'Parameter restrictions'}</DialogTitle>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Close Parameter Restrictions"
                            onClick={() => {
                                setOpen(false);
                            }}
                        >
                            <XIcon />
                        </Button>
                    </DialogHeader>
                    <DialogBody className="flex flex-col gap-4 py-4">
                        {renderIntro(hasRows, description)}
                        {hasRows && renderFieldRows(rows)}
                    </DialogBody>
                    <DialogFooter className="justify-end border-t border-border pt-3">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setOpen(false);
                            }}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

interface ParameterLabelWithInfoProps {
    children: ReactNode;
    toolParameters: ToolParameterSchema | undefined;
    disabled?: boolean;
    title?: string;
    description?: string;
}

const ParameterLabelWithInfo = ({
    children,
    toolParameters,
    disabled,
    title,
    description,
}: ParameterLabelWithInfoProps) => (
    <div className="flex items-center gap-1">
        <Label className="flex items-center gap-0">{children}</Label>
        <ParameterSchemaInfoTrigger
            toolParameters={toolParameters}
            disabled={disabled}
            title={title}
            description={description}
        />
    </div>
);

export { ParameterLabelWithInfo, ParameterSchemaInfoTrigger };
