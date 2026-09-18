import { CheckCheckIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { showErrorToast, partitionFilesByAccept, getFileTypeErrorMessage } from '@/utils';

import './dropzone.scss';

const TOAST_FILE_TOO_LARGE = 'File exceeds maximum size.';

const toFileList = (files: File[]): FileList => {
    const dt = new DataTransfer();

    files.forEach((f) => dt.items.add(f));

    return dt.files;
};

/**
 * Screens files by type (extension + MIME, via the shared whitelist) then size, toasting a
 * clear error for every rejected file. Returns only the files that pass both checks.
 */
function screenFiles(files: FileList, accept: string, maxFileSizeBytes?: number): File[] {
    const { accepted, rejected } = partitionFilesByAccept(files, accept);

    rejected.forEach((file) => showErrorToast(getFileTypeErrorMessage(file, accept)));

    const survivors: File[] = [];

    accepted.forEach((file) => {
        if (maxFileSizeBytes != null && file.size > maxFileSizeBytes) {
            showErrorToast(TOAST_FILE_TOO_LARGE);
        } else {
            survivors.push(file);
        }
    });

    return survivors;
}

interface DropzoneProps {
    accept: string;
    id?: string;
    multiple: boolean;
    name?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    uploading: boolean;
    progress?: number;
    children?: React.ReactNode;
    className?: string;
    disabled?: boolean;
    global?: boolean;
    inputRef?: React.RefObject<HTMLInputElement | null>;
    onReset?: () => void;
    maxFileSizeBytes?: number;

    label?: string;
    icon?: LucideIcon;
}

const Dropzone = (props: DropzoneProps) => {
    const {
        accept,
        id,
        multiple,
        name,
        onChange: propOnChange,
        uploading,
        progress = 0,
        children,
        className,
        disabled,
        global = false,
        inputRef,
        icon,
        label,
        maxFileSizeBytes,
        ...rest
    } = props;

    const [complete, setComplete] = useState<boolean | null>(null);
    const [dragged, setDragged] = useState(false);
    const globalRef = useRef<HTMLDivElement | null>(null);
    const globalDropFile = useRef<HTMLInputElement | null>(null);
    const dragCounter = useRef(0);
    const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearDragged = useCallback(() => {
        dragCounter.current = 0;
        setDragged(false);
    }, []);

    useEffect(() => {
        if (!uploading && complete === false) {
            setComplete(true);
            completeTimeoutRef.current = setTimeout(() => setComplete(false), 10000);
        } else if (!uploading && complete === null) {
            setComplete(false);
        }

        return () => {
            if (completeTimeoutRef.current !== null) {
                clearTimeout(completeTimeoutRef.current);
                completeTimeoutRef.current = null;
            }
        };
    }, [uploading]);

    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (disabled) return;

            const rawFiles = e.clipboardData?.files;

            if (!rawFiles?.length || !propOnChange) return;

            const files = screenFiles(rawFiles, accept, maxFileSizeBytes);

            if (files.length > 0) {
                setComplete(false);
                propOnChange({
                    target: {
                        files: toFileList(files),
                        multiple,
                    },
                } as React.ChangeEvent<HTMLInputElement>);
            }
        };

        if (!disabled) {
            document.addEventListener('paste', handlePaste, false);

            return () => {
                document.removeEventListener('paste', handlePaste, false);
            };
        }

        return () => {};
    }, [accept, disabled, maxFileSizeBytes, propOnChange]);

    useEffect(() => {
        if (disabled) return;
        const globalDropZone = globalRef.current;

        if (!globalDropZone) return;

        const isFileDrag = (e: DragEvent) => e.dataTransfer?.types?.includes('Files');

        const handleDragEnter = (e: DragEvent) => {
            if (!isFileDrag(e)) return;
            e.preventDefault();
            dragCounter.current += 1;
            if (dragCounter.current === 1) {
                setDragged(true);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            if (!isFileDrag(e)) return;
            e.preventDefault();
            dragCounter.current -= 1;
            if (dragCounter.current <= 0) {
                clearDragged();
            }
        };
        const handleDragOver = (e: DragEvent) => {
            if (!isFileDrag(e)) return;
            e.preventDefault();
        };
        const handleDrop = (e: DragEvent) => {
            if (!isFileDrag(e)) return;
            e.preventDefault();
            clearDragged();

            const rawFiles = e.dataTransfer?.files;

            if (!rawFiles?.length || !propOnChange) return;

            const files = screenFiles(rawFiles, accept, maxFileSizeBytes);

            if (files.length > 0) {
                setComplete(false);
                propOnChange({
                    target: {
                        files: toFileList(files),
                        multiple,
                    },
                } as React.ChangeEvent<HTMLInputElement>);
            }
        };
        const handleDragEnd = () => {
            clearDragged();
        };

        globalDropZone.addEventListener('dragenter', handleDragEnter);
        globalDropZone.addEventListener('dragleave', handleDragLeave);
        globalDropZone.addEventListener('dragover', handleDragOver);
        globalDropZone.addEventListener('drop', handleDrop);
        document.addEventListener('dragend', handleDragEnd, false);

        return () => {
            globalDropZone.removeEventListener('dragenter', handleDragEnter);
            globalDropZone.removeEventListener('dragleave', handleDragLeave);
            globalDropZone.removeEventListener('dragover', handleDragOver);
            globalDropZone.removeEventListener('drop', handleDrop);
            document.removeEventListener('dragend', handleDragEnd, false);
        };
    }, [accept, disabled, clearDragged, maxFileSizeBytes, propOnChange]);

    useEffect(() => {
        if (!disabled) {
            const handleDocumentDrop = () => {
                setTimeout(clearDragged, 0);
            };

            document.addEventListener('drop', handleDocumentDrop, false);

            return () => {
                document.removeEventListener('drop', handleDocumentDrop, false);
            };
        }

        return () => {};
    }, [disabled, clearDragged]);

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawFiles = e.target.files;

        if (dragged) {
            clearDragged();
        }

        if (!rawFiles?.length) return;

        const valid = screenFiles(rawFiles, accept, maxFileSizeBytes);

        if (valid.length === 0) {
            e.target.value = '';

            return;
        }

        if (propOnChange) {
            propOnChange({
                ...e,
                target: {
                    ...e.target,
                    files: toFileList(valid),
                    multiple,
                },
            } as React.ChangeEvent<HTMLInputElement>);
        }
    };

    const isDisabled = () => {
        if (uploading || disabled) {
            return true;
        }

        return false;
    };

    if (global) {
        return (
            <div
                ref={globalRef}
                className={cn(
                    'dropzone-global dropzone-style',
                    uploading ? 'uploading-file' : '',
                    dragged ? 'dragging' : '',
                    className,
                )}
                {...rest}
            >
                {uploading ? null : (
                    <>
                        {dragged ? (
                            <>
                                <div className="dragging dropzone-dragging-overlay">
                                    <div className="dropzone-dragging-content flex flex-col items-center justify-center gap-3 text-center">
                                        <img
                                            src={'/assets/images/file-illustration.svg'}
                                            alt="placeholder"
                                            className="dropzone-drag-illustration"
                                        />
                                        <h2>Drop Here</h2>
                                    </div>
                                </div>
                                <input
                                    ref={inputRef || globalDropFile}
                                    className="dropzone-input global-dropzone dropzone-global-input"
                                    onChange={onChange}
                                    type="file"
                                    id={id}
                                    name={name}
                                    accept={accept}
                                    multiple={multiple}
                                />
                            </>
                        ) : (
                            <></>
                        )}
                    </>
                )}
                {children}
            </div>
        );
    }

    const renderLabel = () => {
        const IconComponent = icon;

        if (complete) {
            return (
                <>
                    <CheckCheckIcon className="size-4 text-white" />
                    <>Upload Complete</>
                </>
            );
        }

        return (
            <>
                {IconComponent ? <IconComponent /> : null}
                <>{label}</>
            </>
        );
    };

    return (
        <label
            htmlFor={id}
            className={cn(
                'dropzone-label dropzone-style flex flex-col items-center justify-center gap-3 p-4',
                uploading ? 'uploading-file' : '',
                isDisabled() ? 'disabled' : '',
            )}
            {...rest}
        >
            {uploading ? (
                <div className="progress-bar-controller progress-controller">
                    <div className="progress-status -mx-2 flex flex-[100%] items-center justify-between">
                        <span className="text-sm">Uploading File</span>
                        <span className="text-sm">{`${progress}%`}</span>
                    </div>
                    <ProgressBar className="w-full" value={`${progress}%`} />
                </div>
            ) : (
                <>
                    <span className="text-sm">Drag & Drop</span>
                    <small className="dropzone-small">or</small>
                    <Button disabled={isDisabled()}>{renderLabel()}</Button>
                    <input
                        ref={inputRef}
                        onChange={onChange}
                        className="dropzone-input"
                        type="file"
                        id={id}
                        disabled={isDisabled()}
                        name={name}
                        accept={accept}
                        multiple={multiple}
                    />
                </>
            )}
        </label>
    );
};

export default Dropzone;
