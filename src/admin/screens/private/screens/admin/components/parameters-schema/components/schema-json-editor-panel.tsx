import { DownloadIcon, UploadIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

export interface SchemaJsonEditorPanelProps {
    canUserEdit: boolean;
    isDraggingSchema: boolean;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onDownloadSchema: () => void;
    onUploadSchemaClick: () => void;
    onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onDragOverCapture: (event: React.DragEvent) => void;
    onDragLeaveCapture: (event: React.DragEvent) => void;
    onDropCapture: (event: React.DragEvent) => void;
    renderJsonField: () => ReactNode;
}

const renderDragOverlay = () => (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/85 text-center">
        <img src="/assets/images/file-illustration.svg" alt="" className="shared-drag-illustration" />
        <p className="text-xl font-bold">Drop Here</p>
    </div>
);

/** The desktop "JSON Schema" pane: drag-and-drop capture, download/upload actions, and the
 * shared JSON editor field. Hidden below the `lg` breakpoint in favor of the slide-in overlay. */
const SchemaJsonEditorPanel = ({
    canUserEdit,
    isDraggingSchema,
    fileInputRef,
    onDownloadSchema,
    onUploadSchemaClick,
    onFileUpload,
    onDragOverCapture,
    onDragLeaveCapture,
    onDropCapture,
    renderJsonField,
}: SchemaJsonEditorPanelProps) => (
    <div
        className="json-editor-pane relative flex flex-col gap-0 max-lg:hidden"
        onDragEnterCapture={onDragOverCapture}
        onDragOverCapture={onDragOverCapture}
        onDragLeaveCapture={onDragLeaveCapture}
        onDropCapture={onDropCapture}
    >
        {isDraggingSchema ? renderDragOverlay() : null}
        <div className="mb-2.5 flex items-center justify-between border-b border-border pb-2.5">
            <span className="text-sm font-semibold">JSON Schema</span>
            <div className="flex items-center gap-2">
                {canUserEdit && (
                    <Button size="xs" variant="outline" onClick={onDownloadSchema}>
                        <DownloadIcon className="size-3.5" />
                        Download Schema
                    </Button>
                )}
                {canUserEdit && (
                    <>
                        <input
                            type="file"
                            accept=".json,application/json"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={onFileUpload}
                        />
                        <Button size="xs" variant="outline" onClick={onUploadSchemaClick}>
                            <UploadIcon className="size-3.5" />
                            Upload Schema
                        </Button>
                    </>
                )}
            </div>
        </div>
        {renderJsonField()}
    </div>
);

export default SchemaJsonEditorPanel;
