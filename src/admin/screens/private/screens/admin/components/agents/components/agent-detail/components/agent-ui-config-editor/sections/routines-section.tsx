import { CalendarClockIcon } from 'lucide-react';

import { CheckboxShadcn } from '@/components/ui/checkbox';

import AccordionSection from '../components/primitives/accordion-section';
import FormRow from '../components/primitives/form-row';
import type { ChatUiConfig } from '../schema';

type RoutinesValue = ChatUiConfig['routines'];

interface Props {
    value: RoutinesValue;
    onChange: (next: RoutinesValue) => void;
    disabled?: boolean;
    errorCount?: number;
}

const RoutinesSection = ({ value, onChange, disabled, errorCount }: Props) => {
    const enabled = value?.enabled ?? true;

    const handleEnabledChange = (checked: boolean) => {
        if (disabled) return;

        if (!checked) {
            onChange({ enabled: false });

            return;
        }
        onChange(undefined);
    };

    return (
        <AccordionSection
            id="routines"
            title="Routines"
            icon={<CalendarClockIcon className="size-3.5" />}
            required={false}
            errorCount={errorCount}
        >
            <div className="-mx-4 -mb-4 border-t border-border">
                <FormRow
                    label="Routines"
                    sub="Schedule research that runs on its own and reports back. On by default — switch off for clients who should not see it."
                >
                    <label className="flex cursor-pointer items-center gap-2.5">
                        <CheckboxShadcn
                            disabled={disabled}
                            checked={enabled}
                            onCheckedChange={(c) => handleEnabledChange(c === true)}
                        />
                        <span className="text-sm font-medium">Enable routines</span>
                    </label>
                </FormRow>
            </div>
        </AccordionSection>
    );
};

export default RoutinesSection;
