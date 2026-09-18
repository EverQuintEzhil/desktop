import { ActionBarMorePrimitive, useAui, useAuiState } from '@assistant-ui/react';
import { CheckIcon, RefreshCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from './action-menu-styles';

export interface RegenerateModel {
    modelId: string;
    label: string;
}

interface RegenerateMenuProps {
    models?: RegenerateModel[];
}

export const RegenerateMenu = ({ models = [] }: RegenerateMenuProps) => {
    const aui = useAui();
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const currentModelId = useAuiState((s) => {
        const metadata = s.message.metadata as { aiModel?: string; custom?: { aiModel?: string } } | undefined;

        return metadata?.custom?.aiModel ?? metadata?.aiModel;
    });

    return (
        <ActionBarMorePrimitive.Root>
            <Tooltip>
                <TooltipTrigger asChild>
                    <ActionBarMorePrimitive.Trigger asChild>
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            className="justify-center"
                            disabled={isRunning}
                            aria-label="Regenerate response"
                        >
                            <RefreshCcw />
                        </Button>
                    </ActionBarMorePrimitive.Trigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="pointer-events-none">
                    Regenerate response
                </TooltipContent>
            </Tooltip>
            <ActionBarMorePrimitive.Content align="start" className={MENU_CONTENT_CLASS}>
                <ActionBarMorePrimitive.Item className={MENU_ITEM_CLASS} onSelect={() => aui.message.reload()}>
                    <RefreshCcw className="size-3.5" />
                    Try again
                </ActionBarMorePrimitive.Item>
                {models.length > 0 && (
                    <>
                        <div className="my-1 border-t" />
                        <p className="px-2 py-1.5 text-xs text-muted-foreground">Switch model</p>
                        {models.map((model) => (
                            <ActionBarMorePrimitive.Item
                                key={model.modelId}
                                className={MENU_ITEM_CLASS}
                                onSelect={() =>
                                    aui.message.reload({ runConfig: { custom: { modelId: model.modelId } } })
                                }
                            >
                                <span className="flex-1 truncate">{model.label}</span>
                                {model.modelId === currentModelId ? <CheckIcon className="size-3.5" /> : null}
                            </ActionBarMorePrimitive.Item>
                        ))}
                    </>
                )}
            </ActionBarMorePrimitive.Content>
        </ActionBarMorePrimitive.Root>
    );
};
