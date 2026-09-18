import { FolderIcon } from 'lucide-react';

import { CheckboxShadcn } from '@/components/ui/checkbox';

import AccordionSection from '../components/primitives/accordion-section';
import FormRow from '../components/primitives/form-row';
import type { ChatUiConfig } from '../schema';

type ProjectsValue = ChatUiConfig['spaces'];

interface Props {
    value: ProjectsValue;
    onChange: (next: ProjectsValue) => void;
    disabled?: boolean;
    errorCount?: number;
}

const ProjectsSection = ({ value, onChange, disabled, errorCount }: Props) => {
    const enabled = value?.enabled ?? false;

    const handleEnabledChange = (checked: boolean) => {
        if (disabled) return;

        if (!checked) {
            onChange(undefined);

            return;
        }
        onChange({ enabled: true });
    };

    return (
        <AccordionSection
            id="projects"
            title="Spaces"
            icon={<FolderIcon className="size-3.5" />}
            required={false}
            errorCount={errorCount}
        >
            <div className="-mx-4 -mb-4 border-t border-border">
                <FormRow label="Spaces" sub="Group chats, instructions, and files into spaces">
                    <label className="flex cursor-pointer items-center gap-2.5">
                        <CheckboxShadcn
                            disabled={disabled}
                            checked={enabled}
                            onCheckedChange={(c) => handleEnabledChange(c === true)}
                        />
                        <span className="text-sm font-medium">Enable spaces</span>
                    </label>
                </FormRow>
            </div>
        </AccordionSection>
    );
};

export default ProjectsSection;
