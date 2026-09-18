import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpIcon, Bell, Loader2, MessageSquare, Plus, Sparkles, Tag } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useTextWrapDetection } from '@/app/hooks';
import ComposerFilePreviewList from '@/components/chat/primitives/composer-file-preview-list';
import Dropzone from '@/components/dropzone';
import TextArea from '@/components/text-area';
import type { TextAreaRef } from '@/components/text-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppSelector, useTenantLogo } from '@/hooks';
import { filesApi } from '@/lib/api';
import { selectTenant } from '@/store/selectors';
import type { FileType } from '@/types/chat';

import { MY_AGENTS_QUERY_KEY } from '../agents/hooks/use-agents-queries';

import { getFileType, useLocalAttachments } from './components/composer/use-local-attachments';
import { createDraftAgent } from './lib/create-agent-api';
import './create-agent.scss';

interface SuggestionItem {
    Icon: React.ComponentType<{ size?: number }>;
    name: string;
    desc: string;
}

const SUGGESTIONS: SuggestionItem[] = [
    { Icon: MessageSquare, name: 'Team Q&A bot', desc: 'Answer questions from internal documentation' },
    { Icon: Bell, name: 'Daily planner', desc: 'Prepare my day from calendar and open tasks' },
    { Icon: Tag, name: 'Intake triage', desc: 'Review incoming requests and route to the right team' },
];

const CreateAgent = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const tenant = useAppSelector(selectTenant);
    const [input, setInput] = useState('');
    const [creating, setCreating] = useState(false);
    const textAreaRef = useRef<TextAreaRef>(null);
    const isNextLine = useTextWrapDetection(textAreaRef, input);
    const { files, inputRef, openPicker, handleInputChange, removeAt, getRawFiles } = useLocalAttachments();
    const tenantLogo = useTenantLogo();

    const uploadInitialFiles = async (agentId: string): Promise<FileType[]> => {
        const rawFiles = getRawFiles();

        if (rawFiles.length === 0) {
            return [];
        }

        const results = await Promise.allSettled(
            rawFiles.map(({ file }) => {
                const form = new FormData();

                form.append('files', file);
                form.append('agent_id', agentId);
                form.append('origin.type', 'chat');
                form.append('origin.agent_id', agentId);

                return filesApi.upload(form);
            }),
        );

        const uploadedFiles: FileType[] = [];
        let failures = 0;

        results.forEach((result) => {
            const uploaded = result.status === 'fulfilled' ? result.value.data?.value?.values?.[0] : undefined;

            if (!uploaded) {
                failures += 1;

                return;
            }

            const name = uploaded.name ?? 'file';

            uploadedFiles.push({
                name,
                type: getFileType(name),
                url: uploaded.url,
                location: uploaded.location,
                _id: uploaded._id,
            });
        });

        if (failures > 0) {
            toast.error('Some attachments could not be added.');
        }

        return uploadedFiles;
    };

    const createAndOpen = async (initialPrompt?: string) => {
        if (creating) {
            return;
        }

        setCreating(true);
        try {
            const defaultModelId = tenant.defaultAgentModel || undefined;
            const modelOptions = defaultModelId ? { defaultModelId, modelIds: [defaultModelId] } : undefined;
            const agent = await createDraftAgent(undefined, modelOptions);

            void queryClient.invalidateQueries({ queryKey: MY_AGENTS_QUERY_KEY });

            const initialFiles = await uploadInitialFiles(agent._id);

            navigate(`/agent-builder/${agent._id}`, {
                state: {
                    ...(initialPrompt ? { initialPrompt } : {}),
                    ...(initialFiles.length ? { initialFiles } : {}),
                },
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to create agent. Please try again.';

            toast.error(message);
            setCreating(false);
        }
    };

    const handleSubmit = (text: string) => {
        void createAndOpen(text);
    };

    const handleStartBlank = () => {
        void createAndOpen();
    };

    const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLParagraphElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const trimmed = input.trim();

            if (trimmed) {
                handleSubmit(trimmed);
            }
        }
    };

    const handleSendClick = () => {
        const trimmed = input.trim();

        if (trimmed) {
            handleSubmit(trimmed);
        }
    };

    return (
        <Dropzone
            multiple
            global
            accept=""
            onChange={handleInputChange}
            uploading={false}
            disabled={creating}
            className="ca-entry ca-entry-dropzone"
        >
            <nav className="ca-entry__topnav">
                <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => navigate('/')}
                    aria-label={`Back to ${tenant.name || 'Fluentmind'}`}
                >
                    <ArrowLeft size={15} aria-hidden="true" />
                    {tenant.name || 'Fluentmind'}
                </Button>
                <Button className="rounded-full px-4" size="sm" onClick={handleStartBlank} disabled={creating}>
                    {creating && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                    Start blank
                </Button>
            </nav>

            <div className="ca-entry__center">
                <div className="ca-entry__mark">
                    <img className="ca-entry__logo" src={tenantLogo} alt={tenant.name} />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                    <h1 className="ca-entry__heading">Create a new agent</h1>
                    <Badge
                        variant="outline"
                        className="ca-entry__beta-badge mt-1 rounded-full px-2.5 text-[11px] tracking-wider uppercase"
                    >
                        <Sparkles aria-hidden="true" />
                        Beta
                    </Badge>
                </div>

                <div className="ca-entry__composer-wrap">
                    <div className={`ca-entry__composer${isNextLine ? ' ca-entry__composer--next-line' : ''}`}>
                        <ComposerFilePreviewList files={files} fileInputRef={inputRef} onRemove={removeAt} />
                        <button
                            type="button"
                            className="ca-entry__composer-action"
                            aria-label="Attach file"
                            onClick={openPicker}
                            disabled={creating}
                        >
                            <Plus size={17} aria-hidden="true" />
                        </button>
                        <TextArea
                            ref={textAreaRef}
                            className="ca-entry__composer-input"
                            placeholder="Describe what it should do"
                            value={input}
                            onChange={setInput}
                            onKeyDown={handleComposerKeyDown}
                            autoFocus
                        />
                        <Button
                            size="icon-sm"
                            className="ca-entry__composer-send justify-center rounded-full"
                            onClick={handleSendClick}
                            disabled={!input.trim() || creating}
                            aria-label="Submit"
                        >
                            {creating ? (
                                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                            ) : (
                                <ArrowUpIcon size={16} aria-hidden="true" />
                            )}
                        </Button>
                        <input
                            ref={inputRef}
                            type="file"
                            multiple
                            accept=""
                            className="hidden"
                            onChange={handleInputChange}
                            aria-hidden="true"
                            tabIndex={-1}
                        />
                    </div>
                </div>

                <div className="ca-entry__suggestions">
                    {SUGGESTIONS.map((s) => (
                        <button
                            key={s.name}
                            className="ca-entry__sugg"
                            onClick={() => handleSubmit(s.desc)}
                            disabled={creating}
                        >
                            <span className="ca-entry__sugg-icon">
                                <s.Icon size={15} />
                            </span>
                            <span className="ca-entry__sugg-body">
                                <span className="ca-entry__sugg-name">{s.name}</span>
                                <span className="ca-entry__sugg-desc">{s.desc}</span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </Dropzone>
    );
};

export default CreateAgent;
