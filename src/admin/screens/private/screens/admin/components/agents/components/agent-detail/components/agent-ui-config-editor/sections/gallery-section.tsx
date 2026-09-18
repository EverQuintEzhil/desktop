import { ImagesIcon } from 'lucide-react';
import * as React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import type { ComboboxOption } from '@/components/ui/select';
import Select from '@/components/ui/select';
import { adminAgentsApi } from '@/lib/api/admin/agents';

import StringListEditor from '../components/editors/string-list-editor';
import AccordionSection from '../components/primitives/accordion-section';
import FormRow from '../components/primitives/form-row';
import { fetchAgentsSuggestion } from '../hooks/use-agents-suggestion';
import type { GalleryUiConfig } from '../schema';

interface Props {
    value: GalleryUiConfig;
    onChange: (patch: Partial<GalleryUiConfig>) => void;
    showQuotes: boolean;
    onShowQuotesChange: (showQuotes: boolean) => void;
    disabled?: boolean;
    errorCount?: number;
}

const GallerySection = ({ value, onChange, showQuotes, onShowQuotesChange, disabled, errorCount }: Props) => {
    const [videoAgentOption, setVideoAgentOption] = React.useState<ComboboxOption<string> | undefined>(undefined);

    React.useEffect(() => {
        if (!value.videoAgentSlug) {
            setVideoAgentOption(undefined);

            return;
        }
        adminAgentsApi
            .getBySlugOrId(value.videoAgentSlug)
            .then((agent) => {
                if (agent?.slug) {
                    setVideoAgentOption({ value: agent.slug, label: `${agent.name} (${agent.slug})` });
                }
            })
            .catch(() => undefined);
    }, [value.videoAgentSlug]);

    return (
        <AccordionSection
            id="gallery-options"
            title="Gallery Options"
            icon={<ImagesIcon className="size-3.5" />}
            required={false}
            description="Rotating placeholders and quotes shown in the gallery."
            errorCount={errorCount}
        >
            <div className="-mx-4 -mb-4 border-t border-border">
                <FormRow label="Prompt placeholders" sub="One chosen at random per session">
                    <StringListEditor
                        disabled={disabled}
                        value={value.promptPlaceholders ?? []}
                        onChange={(next) =>
                            onChange({
                                promptPlaceholders: next.length ? next : undefined,
                            })
                        }
                    />
                </FormRow>
                <FormRow label="Quotes" sub="Shown in the masonry empty state">
                    <StringListEditor
                        disabled={disabled}
                        value={value.quotes ?? []}
                        onChange={(next) => onChange({ quotes: next.length ? next : undefined })}
                    />
                    <div className="mt-2 flex items-center gap-2">
                        <Checkbox
                            checked={showQuotes}
                            className="size-3 rounded-[3px] [&_svg]:size-2.5"
                            labelClassName="text-xs"
                            label="Show quotes in the preview"
                            onChange={(_, checked) => onShowQuotesChange(checked)}
                        />
                    </div>
                </FormRow>
                <FormRow label="Video agent slug" sub="Agent opened when converting image→video">
                    <Select<string>
                        variant="outline"
                        allowSearch
                        placeholder="Search agents…"
                        disabled={disabled}
                        value={value.videoAgentSlug ?? null}
                        defaultOption={videoAgentOption}
                        options={async (q: string) => {
                            const items = await fetchAgentsSuggestion(q);

                            return items.map((i) => ({ value: i.slug, label: i.label }));
                        }}
                        onChange={(v) => onChange({ videoAgentSlug: v ?? undefined })}
                    />
                </FormRow>
            </div>
        </AccordionSection>
    );
};

export default GallerySection;
