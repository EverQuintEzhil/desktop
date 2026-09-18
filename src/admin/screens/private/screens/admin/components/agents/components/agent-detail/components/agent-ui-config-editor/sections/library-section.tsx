import { LibraryIcon } from 'lucide-react';

import { CheckboxShadcn } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

import AccordionSection from '../components/primitives/accordion-section';
import FormRow from '../components/primitives/form-row';
import type { ChatUiConfig } from '../schema';

interface Props {
    value: ChatUiConfig['library'];
    onChange: (next: ChatUiConfig['library']) => void;
    disabled?: boolean;
    errorCount?: number;
}

const LibrarySection = ({ value, onChange, disabled, errorCount }: Props) => {
    const enabled = !!value;
    const isObj = value && typeof value === 'object';

    return (
        <AccordionSection
            id="library"
            title="Library panel"
            icon={<LibraryIcon className="size-3.5" />}
            required={false}
            description="Side panel for saved items."
            errorCount={errorCount}
        >
            <div className="-mx-4 -mb-4 border-t border-border">
                <FormRow label="Library tab" sub="A separate tab for the user's saved items">
                    <label className="flex cursor-pointer items-center gap-2.5">
                        <CheckboxShadcn
                            disabled={disabled}
                            checked={enabled}
                            onCheckedChange={(c) => onChange(c === true ? true : undefined)}
                        />
                        <span className="text-sm font-medium">Enable library tab</span>
                    </label>
                </FormRow>
                {enabled ? (
                    <>
                        <FormRow label="Floating chat box" sub="Small composer floating over the library">
                            <label className="flex cursor-pointer items-center gap-2.5">
                                <CheckboxShadcn
                                    disabled={disabled}
                                    checked={isObj ? (value.showFloatingChatBox ?? false) : false}
                                    onCheckedChange={(c) =>
                                        onChange({
                                            ...(isObj ? value : {}),
                                            showFloatingChatBox: c === true,
                                        })
                                    }
                                />
                                <span className="text-sm font-medium">Show floating chat box</span>
                            </label>
                        </FormRow>
                        <FormRow label="Search placeholder">
                            <Input
                                readOnly={disabled}
                                value={isObj ? (value.searchPlaceholder ?? '') : ''}
                                placeholder="Search your library…"
                                onChange={(e) =>
                                    onChange({
                                        ...(isObj ? value : {}),
                                        searchPlaceholder: e.target.value || undefined,
                                    })
                                }
                            />
                        </FormRow>
                    </>
                ) : null}
            </div>
        </AccordionSection>
    );
};

export default LibrarySection;
