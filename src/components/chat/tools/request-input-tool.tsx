import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { CircleCheck, CircleSlash, FormInput } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';

import { ChatBlock } from '@/components/chat/blocks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TextAreaForm from '@/components/ui/textarea-form';
import { getSafeHttpUrl } from '@/utils/url';

import { ToolRailStep } from './tool-rail';
import { useIsLastMessage } from './use-is-last-message';

const inputFieldSchema = z.object({
    name: z.string().describe('Machine key for this field. It is the key under which the value is returned.'),
    label: z.string().describe('Field label shown to the user.'),
    type: z.enum(['text', 'textarea', 'url', 'email', 'number']).optional().describe('Input kind. Defaults to text.'),
    placeholder: z.string().optional().describe('Example value shown in the empty field.'),
    description: z.string().optional().describe('Helper text shown beneath the field.'),
    required: z.boolean().optional().describe('Set true when the value must be provided before submitting.'),
});

export const requestInputParameters = z.object({
    title: z.string().describe('What you need from the user, as a short heading.'),
    description: z.string().optional().describe('One line of context explaining why you need it.'),
    fields: z
        .array(inputFieldSchema)
        .min(1)
        .max(8)
        .describe('The fields to collect. Never request passwords, tokens, API keys or any other secret here.'),
    submitLabel: z.string().optional().describe('Label for the submit button. Defaults to "Submit".'),
});

type InputField = z.infer<typeof inputFieldSchema>;

const requestInputResultSchema = z.object({
    values: z.record(z.string(), z.string()),
    // Distinguishes a refusal from an intentionally empty submit.
    skipped: z.boolean().optional(),
});

type RequestInputResult = z.infer<typeof requestInputResultSchema>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateField = (field: InputField, raw: string): string | undefined => {
    const value = raw.trim();

    if (!value) {
        return field.required ? 'This is required.' : undefined;
    }

    if (field.type === 'url' && !getSafeHttpUrl(value)) {
        return 'Enter a valid http or https URL.';
    }

    if (field.type === 'email' && !EMAIL_PATTERN.test(value)) {
        return 'Enter a valid email address.';
    }

    if (field.type === 'number' && !Number.isFinite(Number(value))) {
        return 'Enter a number.';
    }

    return undefined;
};

const RequestInputTool = ({ args, result, addResult, status, toolCallId }: ToolCallMessagePartProps) => {
    const parsed = requestInputParameters.safeParse(args);
    const isLastMessage = useIsLastMessage();
    const parsedResult = requestInputResultSchema.safeParse(result);
    const [values, setValues] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState<RequestInputResult | null>(null);
    const settled = parsedResult.success ? parsedResult.data : submitted;

    // Args stream in field by field; without the status gate the form is submittable before every
    // field has arrived.
    if (!parsed.success || (status.type === 'running' && !settled)) {
        return (
            <ToolRailStep tone="muted" icon={<FormInput className="size-4" aria-hidden="true" />}>
                <ChatBlock bodyClassName="p-4 text-sm text-muted-foreground">Preparing form…</ChatBlock>
            </ToolRailStep>
        );
    }

    const { title, description, fields, submitLabel } = parsed.data;

    // An answer submitted from an older message has no paused run to resume, so it would go
    // nowhere — render the form inert instead.
    if (!settled && !isLastMessage) {
        return (
            <ToolRailStep tone="muted" icon={<FormInput className="size-4" aria-hidden="true" />}>
                <ChatBlock bodyClassName="flex flex-col gap-1 p-4">
                    <span className="text-sm font-medium text-muted-foreground">{title}</span>
                    <span className="text-sm text-muted-foreground">
                        No longer active — the conversation has moved on.
                    </span>
                </ChatBlock>
            </ToolRailStep>
        );
    }

    const setValue = (name: string, value: string) => {
        setValues((previous) => ({ ...previous, [name]: value }));
        setErrors((previous) => ({ ...previous, [name]: '' }));
    };

    const handleSubmit = () => {
        if (settled) return;

        const nextErrors: Record<string, string> = {};

        for (const field of fields) {
            const message = validateField(field, values[field.name] ?? '');

            if (message) nextErrors[field.name] = message;
        }

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);

            return;
        }

        const collected: Record<string, string> = {};

        for (const field of fields) {
            const value = (values[field.name] ?? '').trim();

            if (value) collected[field.name] = value;
        }

        setSubmitted({ values: collected });
        addResult({ values: collected } satisfies RequestInputResult);
    };

    const handleDecline = () => {
        if (settled) return;

        const declined: RequestInputResult = { values: {}, skipped: true };

        setSubmitted(declined);
        addResult(declined);
    };

    const renderField = (field: InputField) => {
        const id = `request-input-${toolCallId}-${field.name}`;
        const value = values[field.name] ?? '';
        const error = errors[field.name];

        return (
            <div key={field.name} className="flex flex-col gap-1.5">
                <Label htmlFor={id} className="text-sm font-medium text-muted-foreground">
                    {field.label}
                    {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                </Label>
                {field.type === 'textarea' ? (
                    <TextAreaForm
                        id={id}
                        name={field.name}
                        className="min-h-[72px]"
                        placeholder={field.placeholder}
                        value={value}
                        onChange={(next) => setValue(field.name, next)}
                    />
                ) : (
                    <Input
                        id={id}
                        type={field.type === 'number' ? 'number' : 'text'}
                        placeholder={field.placeholder}
                        value={value}
                        onChange={(event) => setValue(field.name, event.target.value)}
                    />
                )}
                {field.description ? <span className="text-xs text-muted-foreground">{field.description}</span> : null}
                {error ? <span className="text-xs text-destructive">{error}</span> : null}
            </div>
        );
    };

    const renderSettledSummary = (settledResult: RequestInputResult) => {
        const provided = fields.filter((field) => settledResult.values[field.name]);

        if (settledResult.skipped || provided.length === 0) {
            return <span className="text-sm text-muted-foreground">Skipped — nothing was submitted.</span>;
        }

        return (
            <dl className="flex flex-col gap-1.5">
                {provided.map((field) => (
                    <div key={field.name} className="flex min-w-0 items-baseline gap-2 text-sm">
                        <dt className="w-32 shrink-0 text-muted-foreground">{field.label}</dt>
                        <dd className="min-w-0 break-words text-foreground">{settledResult.values[field.name]}</dd>
                    </div>
                ))}
            </dl>
        );
    };

    if (settled) {
        const skipped = settled.skipped || Object.keys(settled.values).length === 0;

        return (
            <ToolRailStep
                tone={skipped ? 'muted' : 'active'}
                icon={
                    skipped ? (
                        <CircleSlash className="size-4" aria-hidden="true" />
                    ) : (
                        <CircleCheck className="size-4" aria-hidden="true" />
                    )
                }
            >
                <ChatBlock bodyClassName="flex flex-col gap-2 p-4">
                    <span className="text-sm font-medium text-muted-foreground">{title}</span>
                    {renderSettledSummary(settled)}
                </ChatBlock>
            </ToolRailStep>
        );
    }

    return (
        <ToolRailStep tone="muted" icon={<FormInput className="size-4" aria-hidden="true" />}>
            <ChatBlock bodyClassName="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-foreground">{title}</span>
                    {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
                </div>
                {fields.map(renderField)}
                <div className="flex items-center justify-end gap-2">
                    <Button size="xs" variant="ghost" onClick={handleDecline}>
                        Not now
                    </Button>
                    <Button size="xs" onClick={handleSubmit}>
                        {submitLabel ?? 'Submit'}
                    </Button>
                </div>
            </ChatBlock>
        </ToolRailStep>
    );
};

export default RequestInputTool;
export { RequestInputTool };
