import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { Circle, CircleCheck, CornerDownLeft } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { z } from 'zod';

import { ChatBlock } from '@/components/chat/blocks';
import { Button } from '@/components/ui/button';
import { CheckboxShadcn } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroupItemShadcn, RadioGroupShadcn } from '@/components/ui/radio-group';

import { ToolRailStep } from './tool-rail';
import { useIsLastMessage } from './use-is-last-message';

const AskUserStep = ({ answered, children }: { answered: boolean; children: ReactNode }) => (
    <ToolRailStep
        className="aui-ask-user-step"
        tone={answered ? 'active' : 'muted'}
        nodeDataSlot="ask-user-step-node"
        icon={
            answered ? (
                <CircleCheck className="size-4" aria-hidden="true" />
            ) : (
                <Circle className="size-4" aria-hidden="true" />
            )
        }
    >
        {children}
    </ToolRailStep>
);

const optionSchema = z.object({
    label: z.string().describe('Short label shown on the option.'),
    value: z.string().describe('Stable machine value returned when this option is selected.'),
    description: z.string().optional().describe('Optional helper text shown beneath the label.'),
});

export const askUserParameters = z.object({
    question: z.string().describe('The question to ask the user.'),
    options: z
        .array(optionSchema)
        .min(2)
        .describe('The selectable choices. Provide at least two mutually exclusive options.'),
    multiple: z
        .boolean()
        .optional()
        .describe('Set true for multi-select (checkboxes). Omit or false for single-select (radio).'),
});

interface SelectedOption {
    label: string;
    value: string;
}

interface AskUserResult {
    selected: SelectedOption[];
}

const isAskUserResult = (value: unknown): value is AskUserResult => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate = value as { selected?: unknown };

    return Array.isArray(candidate.selected);
};

const AskUserTool = ({ args, result, addResult, status }: ToolCallMessagePartProps) => {
    const parsed = askUserParameters.safeParse(args);
    const isLastMessage = useIsLastMessage();
    const [singleValue, setSingleValue] = useState('');
    const [multiValues, setMultiValues] = useState<string[]>([]);
    const [submitted, setSubmitted] = useState(false);

    const answered = isAskUserResult(result) || submitted;

    if (!parsed.success || (status.type === 'running' && !answered)) {
        return (
            <AskUserStep answered={false}>
                <ChatBlock bodyClassName="p-4 text-sm text-muted-foreground">Preparing question…</ChatBlock>
            </AskUserStep>
        );
    }

    const { question, options, multiple } = parsed.data;

    // An answer submitted from an older message has no paused run to resume, so it would go
    // nowhere — render the question inert instead.
    if (!answered && !isLastMessage) {
        return (
            <AskUserStep answered={false}>
                <ChatBlock bodyClassName="flex flex-col gap-1 p-4">
                    <span className="text-sm font-medium text-muted-foreground">{question}</span>
                    <span className="text-sm text-muted-foreground">
                        No longer active — the conversation has moved on.
                    </span>
                </ChatBlock>
            </AskUserStep>
        );
    }

    const toggleMultiValue = (value: string, checked: boolean) => {
        setMultiValues((previous) => (checked ? [...previous, value] : previous.filter((item) => item !== value)));
    };

    const buildSelected = (): SelectedOption[] => {
        if (multiple) {
            return options
                .filter((option) => multiValues.includes(option.value))
                .map((option) => ({ label: option.label, value: option.value }));
        }

        return options
            .filter((option) => option.value === singleValue)
            .map((option) => ({ label: option.label, value: option.value }));
    };

    const handleSubmit = () => {
        if (submitted) return;

        const selected = buildSelected();

        if (selected.length === 0) return;

        setSubmitted(true);
        addResult({ selected } satisfies AskUserResult);
    };

    const canSubmit = multiple ? multiValues.length > 0 : singleValue.length > 0;

    const renderRadio = () => (
        <RadioGroupShadcn value={singleValue} onValueChange={setSingleValue} className="gap-1">
            {options.map((option, index) => (
                <div
                    key={index}
                    className="flex items-start gap-3 rounded-md px-2 py-1 transition-colors hover:bg-muted"
                >
                    <RadioGroupItemShadcn id={`ask-user-${option.value}`} value={option.value} className="mt-0.5" />
                    <Label
                        htmlFor={`ask-user-${option.value}`}
                        className="flex flex-1 cursor-pointer flex-col items-start gap-0.5 text-sm font-normal"
                    >
                        <span>{option.label}</span>
                        {option.description ? (
                            <span className="text-xs text-muted-foreground">{option.description}</span>
                        ) : null}
                    </Label>
                </div>
            ))}
        </RadioGroupShadcn>
    );

    const renderCheckboxes = () => (
        <div className="flex flex-col gap-1">
            {options.map((option, index) => (
                <div
                    key={index}
                    className="flex items-start gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted"
                >
                    <CheckboxShadcn
                        id={`ask-user-${option.value}`}
                        className="mt-0.5"
                        checked={multiValues.includes(option.value)}
                        onCheckedChange={(checked) => toggleMultiValue(option.value, checked === true)}
                    />
                    <Label
                        htmlFor={`ask-user-${option.value}`}
                        className="flex flex-1 cursor-pointer flex-col items-start gap-0.5 text-sm font-normal"
                    >
                        <span>{option.label}</span>
                        {option.description ? (
                            <span className="text-xs text-muted-foreground">{option.description}</span>
                        ) : null}
                    </Label>
                </div>
            ))}
        </div>
    );

    const renderAnswered = () => {
        const selected = isAskUserResult(result) ? result.selected : buildSelected();
        const labels = selected.map((option) => option.label).join(', ');

        return (
            <AskUserStep answered>
                <ChatBlock bodyClassName="flex flex-col gap-3 p-4">
                    <span className="text-sm font-medium text-foreground">{question}</span>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CircleCheck className="size-4 text-primary" aria-hidden="true" />
                        <span>{labels}</span>
                    </div>
                </ChatBlock>
            </AskUserStep>
        );
    };

    if (answered) {
        return renderAnswered();
    }

    return (
        <AskUserStep answered={false}>
            <ChatBlock bodyClassName="flex flex-col gap-2 p-4">
                <span className="text-sm font-medium text-foreground">{question}</span>
                {multiple ? renderCheckboxes() : renderRadio()}
                <Button size="xs" className="ml-auto gap-1.5 self-start" onClick={handleSubmit} disabled={!canSubmit}>
                    <CornerDownLeft className="size-3.5" aria-hidden="true" />
                    Submit
                </Button>
            </ChatBlock>
        </AskUserStep>
    );
};

export default AskUserTool;
export { AskUserTool };
