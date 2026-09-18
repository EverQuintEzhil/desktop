import { useCallback, useRef, useState } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import { showErrorToast, showSuccessToast, isFileAllowed, getFileTypeErrorMessage, acceptValidFiles } from '@/utils';

import { SCHEMA_FILE_ACCEPT } from '../constants';
import type { ValidateSchemaFieldsOptions } from '../schema-utils';

export interface UseSchemaFileTransferArgs {
    canUserEdit: boolean;
    dataType: string;
    fieldsLength: number;
    getParametersValue: () => Content;
    setParametersValue: (content: Content) => void;
    handleEditorChange: (content: Content) => void;
    validateParametersContent: (value: Content, options?: ValidateSchemaFieldsOptions) => string | null;
}

/** Upload/download/drag-and-drop handling for the JSON Schema document — split out of the
 * schema builder tab so that file-transfer plumbing does not compete with the fields/form
 * state in the same file. */
export const useSchemaFileTransfer = ({
    canUserEdit,
    dataType,
    fieldsLength,
    getParametersValue,
    setParametersValue,
    handleEditorChange,
    validateParametersContent,
}: UseSchemaFileTransferArgs) => {
    const [showUploadConfirm, setShowUploadConfirm] = useState(false);
    const [pendingDroppedFile, setPendingDroppedFile] = useState<File | null>(null);
    const [isDraggingSchema, setIsDraggingSchema] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadSchema = useCallback(() => {
        const value = getParametersValue();
        let contentString = '';

        if ('text' in value && typeof value.text === 'string') {
            contentString = value.text;
        } else if ('json' in value) {
            contentString = JSON.stringify(value.json, null, 2);
        }

        const blob = new Blob([contentString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = url;
        a.download = `${dataType}-schema.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [dataType, getParametersValue]);

    const handleUploadSchemaClick = useCallback(() => {
        if (fieldsLength > 0) {
            setShowUploadConfirm(true);
        } else {
            fileInputRef.current?.click();
        }
    }, [fieldsLength]);

    const processSchemaFile = useCallback(
        (file: File) => {
            if (!isFileAllowed(file, SCHEMA_FILE_ACCEPT)) {
                showErrorToast(getFileTypeErrorMessage(file, SCHEMA_FILE_ACCEPT));

                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                const text = e.target?.result as string;

                try {
                    const parsed = JSON.parse(text);
                    const content = { json: parsed };

                    // Ensure it's a valid JSON Object schema
                    const validationError = validateParametersContent(content, { allowPartialMultipleOf: true });

                    if (validationError) {
                        showErrorToast(`Invalid schema: ${validationError}`);

                        return;
                    }

                    setParametersValue(content);
                    handleEditorChange(content);
                    showSuccessToast('Schema uploaded successfully.');
                } catch (error) {
                    console.error(error);
                    showErrorToast('Failed to parse JSON file.');
                }
            };
            reader.readAsText(file);
        },
        [handleEditorChange, setParametersValue, validateParametersContent],
    );

    const handleFileUpload = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];

            // Reset the input so re-selecting the same file (or a rejected one) fires onChange again.
            event.target.value = '';

            if (!file) {
                return;
            }

            processSchemaFile(file);
        },
        [processSchemaFile],
    );

    // The JSONEditor applies dropped file text natively, so intercept drops in the
    // capture phase (before they reach it) and stage the file for confirmation instead.
    const handleSchemaDragOverCapture = useCallback(
        (event: React.DragEvent) => {
            if (!canUserEdit) return;
            event.preventDefault();
            event.stopPropagation();
            if (!isDraggingSchema) setIsDraggingSchema(true);
        },
        [canUserEdit, isDraggingSchema],
    );

    const handleSchemaDragLeaveCapture = useCallback((event: React.DragEvent) => {
        // Ignore leave events fired while moving between child elements.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setIsDraggingSchema(false);
    }, []);

    const handleSchemaDropCapture = useCallback(
        (event: React.DragEvent) => {
            if (!canUserEdit) return;
            event.preventDefault();
            event.stopPropagation();
            setIsDraggingSchema(false);

            const [file] = acceptValidFiles(event.dataTransfer.files, SCHEMA_FILE_ACCEPT);

            if (!file) return;

            // Always confirm on drop: stage the file and apply it only on confirm.
            setPendingDroppedFile(file);
            setShowUploadConfirm(true);
        },
        [canUserEdit],
    );

    const handleConfirmUpload = useCallback(() => {
        setShowUploadConfirm(false);

        // A dropped file is already in hand — replace with it directly.
        if (pendingDroppedFile) {
            const file = pendingDroppedFile;

            setPendingDroppedFile(null);
            processSchemaFile(file);

            return;
        }

        // Add a tiny delay to allow the modal to close before opening the native file picker
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 50);
    }, [pendingDroppedFile, processSchemaFile]);

    const handleCancelUpload = useCallback(() => {
        setShowUploadConfirm(false);
        setPendingDroppedFile(null);
    }, []);

    return {
        fileInputRef,
        showUploadConfirm,
        pendingDroppedFile,
        isDraggingSchema,
        handleDownloadSchema,
        handleUploadSchemaClick,
        processSchemaFile,
        handleFileUpload,
        handleSchemaDragOverCapture,
        handleSchemaDragLeaveCapture,
        handleSchemaDropCapture,
        handleConfirmUpload,
        handleCancelUpload,
    };
};
