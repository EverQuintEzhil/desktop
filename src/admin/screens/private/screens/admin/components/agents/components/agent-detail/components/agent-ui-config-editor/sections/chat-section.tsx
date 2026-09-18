import { MessageCircleIcon } from 'lucide-react';

import { CheckboxShadcn } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

import AccordionSection from '../components/primitives/accordion-section';
import FormRow from '../components/primitives/form-row';
import type { ChatUiConfig } from '../schema';

interface Props {
    value: ChatUiConfig;
    onChange: (patch: Partial<ChatUiConfig>) => void;
    disabled?: boolean;
    errorCount?: number;
}

const ChatSection = ({ value, onChange, disabled, errorCount }: Props) => {
    const updateHomeSearch = (patch: Partial<NonNullable<ChatUiConfig['home']['search']>>) => {
        onChange({
            home: {
                ...value.home,
                search: { ...(value.home.search ?? {}), ...patch },
            },
        });
    };

    const renderFollowUpRow = () => {
        const checked = value.type === 'chat' ? (value.chat?.followUp ?? true) : (value.search?.followUp ?? true);
        const handleChange = (c: boolean) =>
            value.type === 'chat' ? onChange({ chat: { followUp: c } }) : onChange({ search: { followUp: c } });

        return (
            <label className="flex cursor-pointer items-start gap-2.5">
                <CheckboxShadcn
                    className="mt-0.5"
                    disabled={disabled}
                    checked={checked}
                    onCheckedChange={(c) => handleChange(c === true)}
                />
                <div>
                    <div className="text-sm font-medium">Show follow-up chat box</div>
                    <div className="text-xs text-text-secondary">Show the follow-up chat box in the chat UI</div>
                </div>
            </label>
        );
    };

    return (
        <AccordionSection
            id="chat-search"
            title={value.type === 'chat' ? 'Chat behavior' : 'Search behavior'}
            icon={<MessageCircleIcon className="size-3.5" />}
            required={false}
            errorCount={errorCount}
        >
            <div className="-mx-4 -mb-4 border-t border-border">
                <FormRow label="Follow-up chat box" sub="Show in the chat UI">
                    {renderFollowUpRow()}
                </FormRow>
                <FormRow label="Related questions" sub="Generated follow-up suggestions for responses">
                    <div className="flex flex-col gap-2">
                        <label className="flex cursor-pointer items-start gap-2.5">
                            <CheckboxShadcn
                                className="mt-0.5"
                                disabled={disabled}
                                checked={value.home.search?.isRelatedQuestionsEnabled ?? false}
                                onCheckedChange={(c) => updateHomeSearch({ isRelatedQuestionsEnabled: c === true })}
                            />
                            <div>
                                <div className="text-sm font-medium">Generate related questions</div>
                                <div className="text-xs text-text-secondary">
                                    Show follow-up suggestions after responses
                                </div>
                            </div>
                        </label>
                        <div className="ml-6 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <label className="text-sm font-medium" htmlFor="related-questions-count">
                                Number of suggestions
                            </label>
                            <Input
                                id="related-questions-count"
                                type="number"
                                min={1}
                                max={5}
                                step={1}
                                disabled={disabled || !value.home.search?.isRelatedQuestionsEnabled}
                                className="w-20"
                                value={value.home.search?.relatedQuestionsCount ?? 3}
                                onChange={(e) => {
                                    const count = Number(e.target.value);

                                    updateHomeSearch({
                                        relatedQuestionsCount:
                                            e.target.value === '' || !Number.isFinite(count)
                                                ? undefined
                                                : Math.min(5, Math.max(1, Math.round(count))),
                                    });
                                }}
                            />
                            <span className="text-xs text-text-secondary">1 to 5</span>
                        </div>
                    </div>
                </FormRow>
            </div>
        </AccordionSection>
    );
};

export default ChatSection;
