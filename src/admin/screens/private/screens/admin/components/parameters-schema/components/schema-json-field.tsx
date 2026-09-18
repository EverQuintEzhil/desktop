import type { Content } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';

import type { ValidateSchemaFieldsOptions } from '../schema-utils';
import type { ParametersSchemaFormApi } from '../types';

export interface SchemaJsonFieldProps {
    form: ParametersSchemaFormApi;
    canUserEdit: boolean;
    className?: string;
    handleEditorChange: (content: Content) => void;
    validateParametersContent: (value: Content, options?: ValidateSchemaFieldsOptions) => string | null;
}

/** The `<form.Field>`-wrapped JSON Schema editor — identical markup is needed for both the
 * desktop pane and the mobile slide-in overlay, so it is shared here rather than duplicated. */
const SchemaJsonField = ({
    form,
    canUserEdit,
    className,
    handleEditorChange,
    validateParametersContent,
}: SchemaJsonFieldProps) => (
    <form.Field
        name="parameters"
        children={(field) => (
            <JSONEditor
                isErrored={false}
                content={field.state.value}
                readOnly={!canUserEdit}
                onBlur={field.handleBlur}
                onChange={(content: Content) => {
                    field.handleChange(content);
                    handleEditorChange(content);
                }}
                className={className}
            />
        )}
        validators={{
            onChange: ({ value }) =>
                validateParametersContent(value, {
                    allowPartialMultipleOf: true,
                }),
        }}
    />
);

export default SchemaJsonField;
