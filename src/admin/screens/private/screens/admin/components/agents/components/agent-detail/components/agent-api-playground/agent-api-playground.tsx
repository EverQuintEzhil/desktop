import { SendIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';

import DynamicFormFields from './components/dynamic-form-fields';
import ResponsePanel from './components/response-panel';
import useAgentAPIPlayground from './hooks/use-agent-api-playground';
import type { AgentAPIPlaygroundFormPanelProps, Props } from './types';
import './agent-api-playground.scss';

export type { FileType } from './types';

const AgentAPIPlayground = (props: Props) => {
    const { agent } = props;

    const {
        isSending,
        response,
        filesState,
        isFilesUploading,
        isFileNotUploaded,
        handleFilesChange,
        handleIsUploading,
        dynamicForm,
    } = useAgentAPIPlayground(agent);

    return (
        <div className="tab-content agent-api-playground">
            <div className="agent-api flex h-[calc(100svh-182px)] overflow-hidden bg-card max-lg:h-auto max-lg:flex-initial max-lg:flex-col max-lg:overflow-auto">
                <AgentAPIPlaygroundFormPanel
                    agent={agent}
                    dynamicForm={dynamicForm}
                    disabled={isFileNotUploaded || isFilesUploading}
                    loading={isSending}
                    handleFilesChange={handleFilesChange}
                    handleIsUploading={handleIsUploading}
                />
                <div className="right-panel flex flex-1 flex-col overflow-hidden bg-card max-lg:flex-initial max-lg:overflow-auto">
                    <div className="response-section flex flex-1 flex-col overflow-hidden max-lg:flex-initial max-lg:overflow-auto">
                        <div className="response-header h-[61px] px-6 py-4">
                            <div className="header-content flex items-center justify-between">
                                <div className="title-section flex items-center gap-3">
                                    <h3 className="flex items-center gap-2 text-base font-semibold">Response</h3>
                                    {response && (
                                        <span className="text-sm">{'error' in response ? 'Error' : 'Success'}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <ResponsePanel
                            response={response}
                            isUploadingFiles={Boolean((filesState as { isUploading?: boolean }).isUploading)}
                            isSending={isSending}
                            disableRetry={Boolean(isFileNotUploaded) || isFilesUploading}
                            onRetry={() => {
                                dynamicForm.handleSubmit();
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AgentAPIPlaygroundFormPanel = (props: AgentAPIPlaygroundFormPanelProps) => {
    const { agent, dynamicForm, disabled, loading, handleFilesChange, handleIsUploading } = props;

    return (
        <div className="left-panel flex w-[400px] min-w-[400px] flex-col border-r border-border-secondary bg-card max-lg:w-full max-lg:min-w-full max-lg:border-r-0 max-lg:border-b">
            <div className="left-panel-header flex h-[61px] items-center justify-between gap-2 border-b border-border-secondary bg-card px-6 py-4">
                <div></div>
                <Button
                    disabled={disabled}
                    onClick={() => {
                        dynamicForm.handleSubmit();
                    }}
                >
                    {loading ? <Spinner className="mr-2" /> : <SendIcon />}
                    Send
                </Button>
            </div>
            <div className="left-panel-content scrollbar-vertical scrollbar-controller flex flex-1 flex-col">
                <div className="dynamic-form-custom-fields grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 p-4">
                    <DynamicFormFields
                        agent={agent}
                        dynamicForm={dynamicForm}
                        loading={loading}
                        handleFilesChange={handleFilesChange}
                        handleIsUploading={handleIsUploading}
                    />
                </div>
            </div>
        </div>
    );
};

export default AgentAPIPlayground;
