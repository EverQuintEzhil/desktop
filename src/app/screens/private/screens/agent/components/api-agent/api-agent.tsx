import { useForm } from '@tanstack/react-form';
import { ChevronLeftIcon, DownloadIcon, RefreshCwIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Content } from 'vanilla-jsoneditor';

import type { SelectSuggestionItem } from '@/components';
import AvatarMenu from '@/components/avatar-menu';
import { renderResponseContent } from '@/components/render-response-content';
import { Button } from '@/components/ui/button';
import { appAgentApi } from '@/lib/api/app/agent';
import type { ApiAgentType, DynamicFormType, FieldType, InputTypeType } from '@/types/admin';
import parseJsonIfValid from '@/utils/parse-json-if-valid';
import resolver from '@/utils/resolver';

import { AgentAPIPlaygroundFormPanel } from './api-playground';
import './api-agent.scss';

interface Props {
    agent: ApiAgentType;
}

interface FileType {
    name: string;
    type?: string;
    url: string;
    _id?: string;
    size?: number;
}

const INPUT_TYPES_DEFAULT_VALUE = {
    text: '',
    textbox: '',
    number: '0',
    radio: '',
    checkbox: [],
    select: { label: '', value: '' } as SelectSuggestionItem<string>,
    multiselect: [],
    filesupload: [],
    jsoneditor: { json: {} } as Content,
};

interface FilesStateType {
    [key: string]: {
        files: FileType[];
        isUploading: boolean;
    };
}

const APIAgent = (props: Props) => {
    const { agent } = props;
    const navigate = useNavigate();

    const [isSending, setIsSending] = useState(false);

    const [response, setResponse] = useState<unknown>(null);
    const [filesState, setFileState] = useState<FilesStateType>({});
    const isFilesUploading = Object.values(filesState).some((files) => files.isUploading);

    const isFileNotUploaded = agent.uiConfig.formSpec?.some((field) => {
        if (field.inputType === 'filesupload' && field.required) {
            if (!filesState?.[field.name] || filesState?.[field.name]?.files?.length === 0) {
                return true;
            }
        }

        return false;
    });

    const handleFilesChange = (name: string, files: FileType[]) => {
        setFileState((prevState) => {
            const prevFiles = prevState[name];

            return {
                ...prevState,
                [name]: { files, isUploading: prevFiles ? prevFiles.isUploading : false },
            };
        });
    };

    const handleIsUploading = (name: string, isUploading: boolean) => {
        setFileState((prevState) => {
            const prevFiles = prevState[name];

            return {
                ...prevState,
                [name]: { isUploading, files: prevFiles ? prevFiles.files : [] },
            };
        });
    };

    const getDefaultValue = () => {
        const defaultValues: DynamicFormType = {};

        agent.uiConfig.formSpec
            ?.filter((field) => field.inputType !== 'filesupload')
            ?.forEach((formField: FieldType) => {
                const key = formField.name;
                const value = INPUT_TYPES_DEFAULT_VALUE[formField.inputType];

                defaultValues[key] = value;
            });

        return defaultValues;
    };

    const dynamicForm = useForm({
        defaultValues: getDefaultValue(),
        onSubmit: async ({ value }: { value: DynamicFormType }) => {
            onSendRequest(value);
        },
    });

    const onSendRequest = async (values: DynamicFormType) => {
        const filesArg: FileType[] = Object.values(filesState).flatMap((item) => item.files);
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
                finalFormValues[key] = (value as { label: string; value: string }[]).map(
                    (val) => val.value,
                ) as string[];
            } else if (formSpecInputType[key] === 'jsoneditor') {
                const parsedCurrentValue = parseJsonIfValid(value as Content);

                finalFormValues[key] = parsedCurrentValue;
            } else {
                finalFormValues[key] = value as string;
            }
        });

        if (isFileNotUploaded) {
            return;
        }

        setIsSending(true);
        setResponse(null);

        try {
            const fileIds = filesArg.map((file) => file._id).filter((id): id is string => Boolean(id));
            const apiResponse = await appAgentApi.executeChat(
                {
                    agentIdOrIdentifier: agent.identifier,
                    conversationId: null,
                    ...(fileIds.length > 0 && { fileIds }),
                    arguments: {
                        ...finalFormValues,
                    },
                    options: {
                        stream: false,
                    },
                },
                { headers: { 'Content-Type': 'application/json' } },
            );

            setResponse(apiResponse);
        } catch (err) {
            console.error('Error sending request:', err);
            const errorMessage =
                err instanceof Error && 'response' in err
                    ? (err as { response?: { data?: { message?: string }; status?: number } }).response?.data
                          ?.message || 'Failed to send request'
                    : 'Failed to send request';
            const errorStatus =
                err instanceof Error && 'response' in err
                    ? (err as { response?: { data?: { message?: string }; status?: number } }).response?.status || 500
                    : 500;

            setResponse({
                error: errorMessage,
                status: errorStatus,
                timestamp: new Date().toISOString(),
            });
        } finally {
            setIsSending(false);
        }
    };

    const downloadFile = (text: string, fileName: string) => {
        const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
        const linkElement = document.createElement('a');

        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', fileName);
        document.body.appendChild(linkElement);
        linkElement.click();
        document.body.removeChild(linkElement);
    };

    const onDownload = () => {
        const uiType = agent.uiConfig?.type?.toLowerCase() || 'jsonviewer';
        const responsePath = agent.uiConfig?.responsePath;

        let displayData: unknown = responsePath ? resolver(response, responsePath) : response;

        if (uiType === 'jsonviewer') {
            if (typeof displayData === 'string') {
                try {
                    displayData = JSON.parse(displayData);
                } catch (e) {
                    console.error('Failed to parse JSON:', e);
                }
            }
            const dataStr = JSON.stringify(displayData, null, 2);

            downloadFile(dataStr, `api-response-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`);
        } else if (uiType === 'markdownviewer') {
            const textData = typeof displayData === 'string' ? displayData : JSON.stringify(displayData, null, 2);

            downloadFile(textData, `api-response-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`);
        } else if (uiType === 'htmlviewer') {
            const textData = typeof displayData === 'string' ? displayData : JSON.stringify(displayData, null, 2);

            downloadFile(textData, `api-response-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.html`);
        } else if (uiType === 'plaintextviewer') {
            const textData = typeof displayData === 'string' ? displayData : JSON.stringify(displayData, null, 2);

            downloadFile(textData, `api-response-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`);
        }
    };

    const renderResponseContentValue = () => {
        if (!response) return null;

        const uiType = agent.uiConfig?.type?.toLowerCase() || 'jsonviewer';
        const responsePath = (agent.uiConfig as { responsePath?: string })?.responsePath;

        const displayData: unknown = responsePath ? resolver(response, responsePath) : response;

        return renderResponseContent(uiType, displayData);
    };

    const renderRightSide = () => {
        if (isFilesUploading || isSending) {
            return (
                <div className="loading-state flex flex-1 flex-col items-center justify-center px-10 py-15">
                    <div className="loading-spinner"></div>
                    <div className="loading-text">
                        {isFilesUploading ? 'Uploading files...' : 'Processing request...'}
                    </div>
                    <div className="loading-description">
                        {isFilesUploading
                            ? 'Please wait while we upload your files'
                            : 'Our AI agent is analyzing your files'}
                    </div>
                </div>
            );
        }

        if (response) {
            return (
                <>
                    <div className="response-content relative flex-1 overflow-hidden p-3">
                        {renderResponseContentValue()}
                    </div>
                    <div className="response-footer sticky bottom-0 z-1 flex items-center justify-end gap-2 px-3 pb-2">
                        <Button
                            size="icon-sm"
                            variant="outline"
                            disabled={!response}
                            onClick={() => {
                                if (response) {
                                    onDownload();
                                }
                            }}
                        >
                            <DownloadIcon />
                            Download
                        </Button>
                        <Button
                            size="icon-sm"
                            variant="outline"
                            disabled={isFileNotUploaded || isFilesUploading}
                            // loading={isSending}
                            onClick={() => {
                                dynamicForm.handleSubmit();
                            }}
                        >
                            <RefreshCwIcon />
                            Retry
                        </Button>
                    </div>
                </>
            );
        }

        return (
            <div className="empty-state relative flex flex-1 flex-col items-center justify-center px-10 py-15">
                <div className="empty-icon">📊</div>
                <div className="empty-description">
                    Upload your files using the panel on the left to see the API response here. Supported formats
                    include images, PDFs, documents, and text files.
                </div>
            </div>
        );
    };

    return (
        <div className="api-agent api-agent-styled flex h-svh w-full flex-col overflow-hidden bg-background max-lg:h-auto max-lg:overflow-auto">
            <div className="agent-header flex items-center gap-2 border-b border-border-secondary bg-card px-6 py-4">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="back-button"
                    onClick={() => navigate('/')}
                    aria-label="Go back"
                >
                    <ChevronLeftIcon />
                </Button>
                <div className="agent-title flex-1">
                    <h1>{agent.name}</h1>
                </div>
                <AvatarMenu />
            </div>

            <div className="api-playground-container flex h-[calc(100svh-73px)] flex-1 overflow-hidden max-lg:h-auto max-lg:flex-initial max-lg:flex-col max-lg:overflow-auto">
                <AgentAPIPlaygroundFormPanel
                    agent={agent}
                    dynamicForm={dynamicForm}
                    disabled={isFileNotUploaded || isFilesUploading}
                    loading={isSending}
                    handleFilesChange={handleFilesChange}
                    handleIsUploading={handleIsUploading}
                />
                <div className="right-panel flex flex-1 flex-col overflow-hidden bg-card max-lg:flex-initial max-lg:overflow-auto">
                    <div className="response-section flex-1 flex-col overflow-hidden">
                        <div className="response-header h-[61px] p-4">
                            <div className="header-content flex items-center justify-between">
                                <div className="title-section flex items-center gap-3">
                                    <h3 className="flex items-center gap-2">Response</h3>
                                    {response ? (
                                        <span className="text-sm">
                                            {typeof response === 'object' && response !== null && 'error' in response
                                                ? 'Error'
                                                : 'Success'}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        {renderRightSide()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default APIAgent;
