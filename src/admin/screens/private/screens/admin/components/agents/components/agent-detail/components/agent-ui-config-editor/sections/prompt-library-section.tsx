import { BookOpenIcon } from 'lucide-react';

import MultiSelect from '@/components/multi-select';
import { CheckboxShadcn } from '@/components/ui/checkbox';

import AccordionSection from '../components/primitives/accordion-section';
import FormRow from '../components/primitives/form-row';
import { fetchModelsSuggestion } from '../hooks/use-models-suggestion';
import type { ChatUiConfig } from '../schema';

type PromptLibraryValue = ChatUiConfig['promptLibrary'];

interface Props {
    value: PromptLibraryValue;
    onChange: (next: PromptLibraryValue) => void;
    disabled?: boolean;
    errorCount?: number;
}

const PromptLibrarySection = ({ value, onChange, disabled, errorCount }: Props) => {
    const enabled = value?.enabled ?? false;
    const aimodelIds = value?.filters?.aimodelIds ?? [];

    const handleEnabledChange = (checked: boolean) => {
        if (disabled) return;

        if (!checked) {
            onChange(undefined);

            return;
        }
        onChange({ enabled: true, filters: { aimodelIds } });
    };

    return (
        <AccordionSection
            id="prompt-library"
            title="Prompt library"
            icon={<BookOpenIcon className="size-3.5" />}
            required={false}
            errorCount={errorCount}
        >
            <div className="-mx-4 -mb-4 border-t border-border">
                <FormRow label="Prompt library" sub="Saved prompts inside the chat composer">
                    <label className="flex cursor-pointer items-center gap-2.5">
                        <CheckboxShadcn
                            disabled={disabled}
                            checked={enabled}
                            onCheckedChange={(c) => handleEnabledChange(c === true)}
                        />
                        <span className="text-sm font-medium">Enable prompt library</span>
                    </label>
                </FormRow>
                {enabled ? (
                    <FormRow label="Filter by models" sub="Only prompts referencing these models will be shown">
                        <MultiSelect<string>
                            allowSearch
                            className="w-full"
                            disabled={disabled}
                            value={aimodelIds.map((id) => ({ value: id, label: id }))}
                            data={async (q) => {
                                const items = await fetchModelsSuggestion(q);

                                return items.map((i) => ({ value: i.modelId, label: i.label }));
                            }}
                            onSelect={(items) => {
                                if (disabled) return;

                                onChange({
                                    enabled: true,
                                    filters: {
                                        aimodelIds: items.map((i) => String(i.value)),
                                    },
                                });
                            }}
                        />
                    </FormRow>
                ) : null}
            </div>
        </AccordionSection>
    );
};

export default PromptLibrarySection;
