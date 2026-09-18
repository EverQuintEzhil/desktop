import { useForm } from '@tanstack/react-form';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import { useParametersSchemaUpdateMutation } from '@/lib/api/admin/parameters-schema';
import { showErrorToast, parseJsonIfValid, showSuccessToast } from '@/utils';

import {
    createField,
    fieldsToSchema,
    getSchemaAdditionalProperties,
    mergeFieldIds,
    schemaToFields,
    validateJsonSchemaDocument,
    validateSchemaFields,
    type SchemaField,
    type ValidateSchemaFieldsOptions,
} from '../schema-utils';
import type { ParametersSchemaDataMap, ParametersSchemaProps } from '../types';

/** Everything the schema builder tab needs to manage the visual fields, the underlying
 * JSON Schema document, and saving — extracted so the file-upload/download hook and the
 * component can share the same form/fields state without re-deriving it. */
export const useParametersSchemaForm = (props: ParametersSchemaProps) => {
    const { data, dataType, onSubmit } = props;

    const updateMutation = useParametersSchemaUpdateMutation();

    const initialParams = ('parameters' in data ? data.parameters : data.inputSchema) as Record<string, unknown>;

    const initialFields = useMemo(() => schemaToFields(initialParams), [data._id]);

    const [fields, setFields] = useState<SchemaField[]>(initialFields);
    const fieldsRef = useRef(fields);

    fieldsRef.current = fields;

    const [rootAdditionalProps, setRootAdditionalProps] = useState(() => getSchemaAdditionalProperties(initialParams));

    const validateParametersContent = useCallback(
        (value: Content, options?: ValidateSchemaFieldsOptions): string | null => {
            const parsed = parseJsonIfValid(value);

            if (!parsed) {
                return 'Parameters must be valid JSON.';
            }

            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                return 'Parameters must be a JSON object (root cannot be an array or primitive).';
            }

            const jsonSchemaConsistencyError = validateJsonSchemaDocument(parsed, '');

            if (jsonSchemaConsistencyError) {
                return jsonSchemaConsistencyError;
            }

            const schemaBuilderError = validateSchemaFields(fieldsRef.current, options);

            if (schemaBuilderError) {
                return schemaBuilderError;
            }

            return null;
        },
        [],
    );

    const onSave = async (value: { parameters: Content }) => {
        try {
            const validationError = validateParametersContent(value.parameters);

            if (validationError) {
                showErrorToast(validationError);

                return;
            }

            const finalParameters = parseJsonIfValid(value.parameters) as Record<string, unknown>;

            const obj = dataType === 'apps' ? { inputSchema: finalParameters } : { parameters: finalParameters };
            const response = await updateMutation.mutateAsync({
                dataType,
                id: data._id,
                data: obj,
            });

            if (dataType === 'models') {
                onSubmit(response as ParametersSchemaDataMap['models']);
            } else if (dataType === 'agents') {
                onSubmit(response as ParametersSchemaDataMap['agents']);
            } else if (dataType === 'apps') {
                onSubmit(response as ParametersSchemaDataMap['apps']);
            } else {
                onSubmit(response as ParametersSchemaDataMap['tools']);
            }
            showSuccessToast(
                `${dataType?.charAt(0).toUpperCase() + dataType?.slice(1)} schema parameters saved successfully.`,
            );
        } catch (error) {
            console.error(error);
            showErrorToast(`Failed to save ${dataType} schema parameters. Please try again.`);
        }
    };

    const form = useForm({
        defaultValues: {
            parameters: {
                json: ('parameters' in data ? data.parameters : data.inputSchema) || {},
            } as Content,
        },
        onSubmit: async ({ value }) => {
            onSave(value);
        },
        onSubmitInvalid: ({ formApi }) => {
            const msg = validateParametersContent(formApi.getFieldValue('parameters'));

            showErrorToast(msg ?? 'Fix validation errors in the JSON Schema before saving.');
        },
    });

    const syncFieldsToForm = useCallback(
        (nextFields: SchemaField[], additionalProps?: boolean) => {
            const ap = additionalProps ?? rootAdditionalProps;
            const schema = fieldsToSchema(nextFields, ap);

            form.setFieldValue('parameters', { json: schema });
        },
        [form, rootAdditionalProps],
    );

    const handleFieldsChange = useCallback(
        (nextFields: SchemaField[]) => {
            fieldsRef.current = nextFields;
            setFields(nextFields);
            syncFieldsToForm(nextFields);
        },
        [syncFieldsToForm],
    );

    const handleRootAdditionalPropsChange = useCallback(
        (_: unknown, checked: boolean) => {
            setRootAdditionalProps(checked);
            syncFieldsToForm(fields, checked);
        },
        [fields, syncFieldsToForm],
    );

    const handleEditorChange = useCallback((content: Content) => {
        const isEmptyText = 'text' in content && typeof content.text === 'string' && content.text.trim() === '';
        const isEmptyJson =
            'json' in content && !('text' in content) && (content.json === null || content.json === undefined);

        if (isEmptyText || isEmptyJson) {
            setFields([]);
            setRootAdditionalProps(false);

            return;
        }

        const parsed = parseJsonIfValid(content);

        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const schema = parsed as Record<string, unknown>;

            setFields((prev) => mergeFieldIds(schemaToFields(schema), prev));
            setRootAdditionalProps(getSchemaAdditionalProperties(schema));
        }
    }, []);

    const handleFieldChange = useCallback(
        (nextField: SchemaField) => {
            handleFieldsChange(fields.map((f) => (f.id === nextField.id ? nextField : f)));
        },
        [fields, handleFieldsChange],
    );

    const handleFieldDelete = useCallback(
        (fieldId: string) => {
            handleFieldsChange(fields.filter((f) => f.id !== fieldId));
        },
        [fields, handleFieldsChange],
    );

    const handleAddField = useCallback(() => {
        handleFieldsChange([...fields, createField()]);
    }, [fields, handleFieldsChange]);

    return {
        form,
        fields,
        rootAdditionalProps,
        isSaving: updateMutation.isPending,
        validateParametersContent,
        handleEditorChange,
        handleRootAdditionalPropsChange,
        handleFieldChange,
        handleFieldDelete,
        handleAddField,
    };
};
