import type { Content } from 'vanilla-jsoneditor';

import type { ApiAgentType, DynamicFormType, InputTypeType } from '@/types/admin';
import parseJsonIfValid from '@/utils/parse-json-if-valid';

/**
 * Flattens the tanstack-form values into the plain shape the agent chat
 * endpoint expects: selects/multiselects unwrap to their raw value(s), and
 * JSON editor content parses to the underlying object.
 */
const buildFinalFormValues = (agent: ApiAgentType, values: DynamicFormType): DynamicFormType => {
    const formSpecInputType: { [key: string]: InputTypeType } = {};

    agent.uiConfig.formSpec?.forEach((field) => {
        formSpecInputType[field.name] = field.inputType;
    });

    const finalFormValues: DynamicFormType = {};

    Object.entries(values).forEach((pair) => {
        const [key, value] = pair;

        if (formSpecInputType[key] === 'select') {
            finalFormValues[key] = (value as { label: string; value: string }).value;
        } else if (formSpecInputType[key] === 'multiselect') {
            finalFormValues[key] = (value as { label: string; value: string }[]).map((val) => val.value) as string[];
        } else if (formSpecInputType[key] === 'jsoneditor') {
            const parsedCurrentValue = parseJsonIfValid(value as Content);

            finalFormValues[key] = parsedCurrentValue;
        } else {
            finalFormValues[key] = value as string;
        }
    });

    return finalFormValues;
};

export default buildFinalFormValues;
