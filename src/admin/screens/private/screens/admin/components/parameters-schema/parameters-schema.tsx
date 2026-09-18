import { useRef, useState } from 'react';

import { useViewportFillHeight } from '@/hooks';

import {
    SchemaBuilderPanel,
    SchemaJsonEditorPanel,
    SchemaJsonField,
    SchemaJsonMobileOverlay,
    SchemaUploadConfirmModal,
} from './components';
import { useParametersSchemaForm, useSchemaFileTransfer } from './hooks';
import type { ParametersSchemaProps } from './types';
import './parameters-schema.scss';

export type { ParametersSchemaDataMap, ParametersSchemaProps, ParametersSchemaType } from './types';

const ParametersSchema = (props: ParametersSchemaProps) => {
    const { canUserEdit, dataType } = props;

    const tabRef = useRef<HTMLDivElement>(null);

    // .tab-content adds top padding, so measure the panes' own top via .schema-builder.
    useViewportFillHeight(tabRef, {
        cssVar: '--params-schema-h',
        measureSelector: '.schema-builder',
        bottomGap: 24,
    });

    const [showJson, setShowJson] = useState(false);

    const {
        form,
        fields,
        rootAdditionalProps,
        isSaving,
        validateParametersContent,
        handleEditorChange,
        handleRootAdditionalPropsChange,
        handleFieldChange,
        handleFieldDelete,
        handleAddField,
    } = useParametersSchemaForm(props);

    const {
        fileInputRef,
        showUploadConfirm,
        isDraggingSchema,
        handleDownloadSchema,
        handleUploadSchemaClick,
        handleFileUpload,
        handleSchemaDragOverCapture,
        handleSchemaDragLeaveCapture,
        handleSchemaDropCapture,
        handleConfirmUpload,
        handleCancelUpload,
    } = useSchemaFileTransfer({
        canUserEdit,
        dataType,
        fieldsLength: fields.length,
        getParametersValue: () => form.getFieldValue('parameters'),
        setParametersValue: (content) => form.setFieldValue('parameters', content),
        handleEditorChange,
        validateParametersContent,
    });

    const renderJsonField = (className?: string) => (
        <SchemaJsonField
            form={form}
            canUserEdit={canUserEdit}
            className={className}
            handleEditorChange={handleEditorChange}
            validateParametersContent={validateParametersContent}
        />
    );

    return (
        <div ref={tabRef} className="tab-content parameters-schema-tab relative overflow-hidden">
            <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
                <SchemaBuilderPanel
                    canUserEdit={canUserEdit}
                    fields={fields}
                    rootAdditionalProps={rootAdditionalProps}
                    isSaving={isSaving}
                    onShowJson={() => setShowJson(true)}
                    onSave={form.handleSubmit}
                    onAddField={handleAddField}
                    onFieldChange={handleFieldChange}
                    onFieldDelete={handleFieldDelete}
                    onRootAdditionalPropsChange={handleRootAdditionalPropsChange}
                />

                <SchemaJsonEditorPanel
                    canUserEdit={canUserEdit}
                    isDraggingSchema={isDraggingSchema}
                    fileInputRef={fileInputRef}
                    onDownloadSchema={handleDownloadSchema}
                    onUploadSchemaClick={handleUploadSchemaClick}
                    onFileUpload={handleFileUpload}
                    onDragOverCapture={handleSchemaDragOverCapture}
                    onDragLeaveCapture={handleSchemaDragLeaveCapture}
                    onDropCapture={handleSchemaDropCapture}
                    renderJsonField={() => renderJsonField()}
                />
            </div>

            <SchemaJsonMobileOverlay
                showJson={showJson}
                onClose={() => setShowJson(false)}
                renderJsonField={() => renderJsonField('h-full')}
            />

            <SchemaUploadConfirmModal
                isOpen={showUploadConfirm}
                hasFields={fields.length > 0}
                onClose={handleCancelUpload}
                onConfirm={handleConfirmUpload}
            />
        </div>
    );
};

export default ParametersSchema;
