import { AppWindowIcon } from 'lucide-react';

import { CheckboxShadcn } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import type { AppType } from '@/types/admin';

import AccordionSection from '../components/primitives/accordion-section';
import FieldErrorMessage from '../components/primitives/field-error-message';
import FormRow from '../components/primitives/form-row';
import type { AppUiConfig } from '../schema';
import type { GetUiConfigFieldError } from '../validation';

type AppPaneValue = AppUiConfig['app'];

interface Props {
    value: AppPaneValue;
    onChange: (next: AppPaneValue) => void;
    disabled?: boolean;
    getError: GetUiConfigFieldError;
    errorCount?: number;
    apps?: AppType[];
}

const AppPaneSection = ({ value, onChange, disabled, getError, errorCount, apps }: Props) => {
    const updateApp = (patch: Partial<AppPaneValue>) => onChange({ ...value, ...patch });

    const eligibleApps = apps ?? [];
    const assistantLabelError = getError('app.assistantLabel');
    // A stored refName the agent no longer links resolves to no option, so the select would show its
    // placeholder and the admin would overwrite a value they never saw.
    const isUnlinked = value.refName !== '' && !eligibleApps.some((app) => app.refName === value.refName);
    const refNameError =
        getError('app.refName') ??
        (isUnlinked
            ? `"${value.refName}" is not linked to this agent. Link it in the Apps tab, or pick another app.`
            : undefined);

    const renderRefName = () => {
        if (eligibleApps.length === 0 && !isUnlinked) {
            return (
                <div className="text-xs text-text-secondary">
                    Attach an app in the Apps tab to render it as the main surface.
                </div>
            );
        }

        return (
            <>
                <Select<string>
                    variant="ghost"
                    className="w-full rounded-md"
                    disabled={disabled}
                    value={value.refName}
                    options={[
                        { value: '', label: 'None' },
                        ...eligibleApps.map((app) => ({ value: app.refName, label: app.name })),
                        ...(isUnlinked ? [{ value: value.refName, label: `${value.refName} (not linked)` }] : []),
                    ]}
                    onChange={(v) => updateApp({ refName: v ?? '' })}
                />
                <FieldErrorMessage error={refNameError} />
            </>
        );
    };

    return (
        <AccordionSection
            id="app-pane"
            title="App pane"
            icon={<AppWindowIcon className="size-3.5" />}
            required
            description="The traditional-app surface rendered beside the assistant."
            errorCount={errorCount}
        >
            <div className="-mx-4 -mb-4 border-t border-border">
                <FormRow label="App" sub="GenUI app rendered as the main surface">
                    {renderRefName()}
                </FormRow>
                <FormRow label="Assistant label" sub="Assistant panel title; defaults to the agent name">
                    <Input
                        readOnly={disabled}
                        isErrored={Boolean(assistantLabelError)}
                        value={value.assistantLabel ?? ''}
                        placeholder="Assistant"
                        onChange={(e) => updateApp({ assistantLabel: e.target.value || undefined })}
                    />
                    <FieldErrorMessage error={assistantLabelError} />
                </FormRow>
                <FormRow label="Assistant side" sub="Users can flip it; the choice is kept per browser">
                    <Select<'left' | 'right'>
                        variant="ghost"
                        className="w-full rounded-md"
                        allowDeselect
                        disabled={disabled}
                        value={value.assistantSide ?? null}
                        options={[
                            { value: 'left', label: 'Left' },
                            { value: 'right', label: 'Right' },
                        ]}
                        onChange={(v) => updateApp({ assistantSide: v ?? undefined })}
                    />
                </FormRow>
                <FormRow label="Toggles" wide>
                    <label className="flex cursor-pointer items-start gap-2.5">
                        <CheckboxShadcn
                            className="mt-0.5"
                            disabled={disabled}
                            checked={value.assistantDefaultOpen ?? false}
                            onCheckedChange={(c) => updateApp({ assistantDefaultOpen: c === true })}
                        />
                        <div>
                            <div className="text-sm font-medium">Assistant open by default</div>
                            <div className="text-xs text-text-secondary">
                                Whether the assistant panel starts open on first visit
                            </div>
                        </div>
                    </label>
                </FormRow>
            </div>
        </AccordionSection>
    );
};

export default AppPaneSection;
