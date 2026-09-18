import { DownloadIcon, RefreshCwIcon } from 'lucide-react';

import JSONEditor from '@/components/json-editor';
import { Button } from '@/components/ui/button';

import downloadJsonResponse from '../utils/download-json-response';

export interface ResponsePanelProps {
    response: Record<string, unknown> | null;
    isUploadingFiles: boolean;
    isSending: boolean;
    disableRetry: boolean;
    onRetry: () => void;
}

const renderLoadingState = (isUploadingFiles: boolean) => (
    <div className="loading-state flex flex-1 flex-col items-center justify-center px-10 py-15">
        <div className="loading-spinner"></div>
        <div className="loading-text">{isUploadingFiles ? 'Uploading files...' : 'Processing request...'}</div>
        <div className="loading-description">
            {isUploadingFiles ? 'Please wait while we upload your files' : 'Our AI agent is analyzing your files'}
        </div>
    </div>
);

const renderEmptyState = () => (
    <div className="empty-state flex flex-1 flex-col items-center justify-center px-10 py-15">
        <div className="empty-icon">📊</div>
        <div className="empty-description">
            Upload your files using the panel on the left to see the API response here. Supported formats include
            images, PDFs, documents, and text files.
        </div>
    </div>
);

const ResponsePanel = (props: ResponsePanelProps) => {
    const { response, isUploadingFiles, isSending, disableRetry, onRetry } = props;

    if (isUploadingFiles || isSending) {
        return renderLoadingState(isUploadingFiles);
    }

    if (!response) {
        return renderEmptyState();
    }

    const isError = 'error' in response;

    return (
        <>
            <div className="response-content flex-1 p-3">
                <div className={`json-container ${isError ? 'is-error' : ''}`}>
                    <JSONEditor
                        content={{
                            json: response,
                        }}
                        mode="text"
                        readOnly
                    />
                </div>
            </div>

            <div className="response-footer sticky bottom-0 z-1 flex items-center justify-end gap-2 px-3 pb-2">
                <Button size="sm" variant="outline" disabled={!response} onClick={() => downloadJsonResponse(response)}>
                    <DownloadIcon />
                    Download
                </Button>
                <Button size="sm" variant="outline" disabled={disableRetry} onClick={onRetry}>
                    <RefreshCwIcon />
                    Retry
                </Button>
            </div>
        </>
    );
};

export default ResponsePanel;
