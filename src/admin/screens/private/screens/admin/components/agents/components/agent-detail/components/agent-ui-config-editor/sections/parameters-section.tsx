import { SlidersVerticalIcon } from 'lucide-react';

import ParametersEditor from '../components/editors/parameters-editor';
import AccordionSection from '../components/primitives/accordion-section';
import type { ChatUiConfig, GalleryUiConfig } from '../schema';
import type { GetUiConfigFieldError } from '../validation';

type ParametersValue = ChatUiConfig['parameters'] | GalleryUiConfig['parameters'];

interface Props {
    value: ParametersValue;
    onChange: (next: ParametersValue) => void;
    disabled?: boolean;
    getError: GetUiConfigFieldError;
    errorCount?: number;
}

const ParametersSection = ({ value, onChange, disabled, getError, errorCount }: Props) => {
    return (
        <AccordionSection
            id="parameters"
            title="Parameters"
            icon={<SlidersVerticalIcon className="size-3.5" />}
            required={false}
            description="Extra controls shown in the '+ More' menu."
            errorCount={errorCount}
        >
            <div className="-mx-4 -mb-4 border-t border-border bg-(--bg-base) p-4">
                <ParametersEditor
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    errorPathPrefix="parameters"
                    getError={getError}
                />
            </div>
        </AccordionSection>
    );
};

export default ParametersSection;
