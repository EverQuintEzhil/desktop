import { BracesIcon, WebhookIcon } from 'lucide-react';

import FormSpecBuilder from '../components/editors/form-spec-builder';
import AccordionSection from '../components/primitives/accordion-section';
import ConfigTextField from '../components/primitives/config-text-field';
import type { ApiUiConfig } from '../schema';
import type { GetUiConfigFieldError } from '../validation';

interface Props {
    value: ApiUiConfig;
    onChange: (patch: Partial<ApiUiConfig>) => void;
    disabled?: boolean;
    getError: GetUiConfigFieldError;
    formSpecErrorCount?: number;
    responseErrorCount?: number;
}

const ApiSection = ({ value, onChange, disabled, getError, formSpecErrorCount, responseErrorCount }: Props) => {
    const renderFormSpec = () => (
        <AccordionSection
            id="api-form-spec"
            title="Form spec"
            icon={<WebhookIcon className="size-3.5" />}
            required
            description="Defines which inputs the end-user sees before calling the API."
            errorCount={formSpecErrorCount}
        >
            <div className="px-4 pb-4">
                <FormSpecBuilder
                    disabled={disabled}
                    value={value.formSpec}
                    getError={getError}
                    onChange={(formSpec) => onChange({ formSpec })}
                />
            </div>
        </AccordionSection>
    );

    const renderResponseShaping = () => (
        <AccordionSection
            id="api-response-shaping"
            title="Response shaping"
            icon={<BracesIcon className="size-3.5" />}
            required={false}
            description="How the response is parsed before rendering."
            errorCount={responseErrorCount}
        >
            <div className="px-4 pb-4">
                <ConfigTextField
                    label="Response path"
                    description="Dot path into the response to extract items."
                    disabled={disabled}
                    value={value.responsePath}
                    onChange={(responsePath) => onChange({ responsePath: responsePath || undefined })}
                />
            </div>
        </AccordionSection>
    );

    return (
        <>
            {renderFormSpec()}
            {renderResponseShaping()}
        </>
    );
};

export default ApiSection;
