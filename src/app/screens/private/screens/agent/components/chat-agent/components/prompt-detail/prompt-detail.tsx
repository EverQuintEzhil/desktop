import { useForm } from '@tanstack/react-form';
import { ArrowLeftIcon, CheckIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { usePermissions } from '@/app/hooks';
import { InstructionsEditor } from '@/components/instructions-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SpinnerBlade } from '@/components/ui/spinner';
import TextAreaForm from '@/components/ui/textarea-form';
import { appAgentApi } from '@/lib/api/app/agent';
import { cn } from '@/lib/utils';
import type { ChatAgentType, PromptType } from '@/types/admin';

import PromptCloneConfirmationModal from './components/prompt-clone-confirmation-modal';
import PromptDetailError from './components/prompt-detail-error';
import PromptDetailLoading from './components/prompt-detail-loading';
import PromptHeaderActions from './components/prompt-header-actions';
import PromptStatusBadges from './components/prompt-status-badges';
import PromptViewer from './components/prompt-viewer';
import PromptVisibilitySettings from './components/prompt-visibility-settings';
import { formatShortDate } from './utils/format-short-date';
import './prompt-detail.scss';

interface Props {
    agent: ChatAgentType;
}

const PromptDetail = (props: Props) => {
    const { agent } = props;
    const navigate = useNavigate();
    const params = useParams();
    const { checkMultiplePermissions } = usePermissions();

    const [state, setState] = useState({
        data: {} as PromptType,
        loading: true,
        error: false,
    });
    const [editMode, setEditMode] = useState<'' | 'edit' | 'clone'>('');
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isDescriptionClamped, setIsDescriptionClamped] = useState(false);

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const descriptionRef = useRef<HTMLParagraphElement>(null);

    const promptDescription = state?.data?.description;

    const onConfirmClick = async () => {
        setEditMode('clone');
        setIsConfirmationModalOpen(false);
    };

    const closeConfirmModal = () => {
        setIsConfirmationModalOpen(false);
    };

    const [canUserEdit, canUserClone] = checkMultiplePermissions([
        {
            module: 'prompts',
            action: 'put',
            resourceContext: {
                creatorId: state?.data?.creator?._id,
            },
        },
        {
            module: 'prompts',
            action: 'clone',
        },
    ]);

    const form = useForm({
        defaultValues: {
            name: state?.data?.name,
            description: state?.data?.description,
            prompt: state?.data?.prompt,
            isPrivate: state?.data?.isPrivate,
            isPublished: state?.data?.isPublished,
        },
        onSubmit: async ({ value }) => {
            setIsSubmitting(true);
            try {
                if (editMode === 'clone') {
                    const cloneRelatedPrompts = state.data?.relatedPrompts?.map((prompt) =>
                        typeof prompt === 'string' ? prompt : prompt._id,
                    );

                    cloneRelatedPrompts?.push(state?.data?._id);
                    const obj = {
                        name: value.name?.trim(),
                        isPrivate: value.isPrivate,
                        isPublished: value.isPublished,
                        description: value.description?.trim(),
                        prompt: value.prompt,
                        agentIds:
                            state.data.agentIds?.map((agentItem) =>
                                typeof agentItem === 'string' ? agentItem : agentItem._id,
                            ) || [],
                        aimodelIds:
                            state.data.aimodelIds?.map((aimodelId) =>
                                typeof aimodelId === 'string' ? aimodelId : aimodelId._id,
                            ) || [],
                        relatedPrompts: cloneRelatedPrompts || [state?.data?._id],
                    };

                    const response = await appAgentApi.createPrompt<{ _id: string }>(obj);

                    navigate(`/agent/${agent.slug}/prompt-library${response?._id ? `/${response._id}` : ''}`);
                } else {
                    const obj = {
                        name: value.name?.trim(),
                        isPrivate: value.isPrivate,
                        isPublished: value.isPublished,
                        description: value.description?.trim(),
                        prompt: value.prompt,
                    };
                    const response = await appAgentApi.updatePrompt<PromptType>(params.promptId!, obj);

                    setState((prevState) => ({
                        ...prevState,
                        data: {
                            ...prevState.data,
                            ...response,
                        },
                    }));
                }
                setEditMode('');
            } catch (error) {
                console.error(error);
            } finally {
                setIsSubmitting(false);
            }
        },
    });

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        setIsDescriptionExpanded(false);
    }, [promptDescription]);

    useEffect(() => {
        const node = descriptionRef.current;

        if (!node) return;

        const measure = () => {
            const prevClamp = node.style.webkitLineClamp;
            const prevDisplay = node.style.display;

            node.style.webkitLineClamp = 'unset';
            node.style.display = 'block';
            const fullHeight = node.scrollHeight;

            node.style.webkitLineClamp = prevClamp;
            node.style.display = prevDisplay;

            const lineHeight = parseFloat(getComputedStyle(node).lineHeight) || 24;

            setIsDescriptionClamped(fullHeight > lineHeight * 2 + 1);
        };

        measure();

        const observer = new ResizeObserver(measure);

        observer.observe(node);

        return () => observer.disconnect();
    }, [promptDescription]);

    const handleCopy = (e: React.MouseEvent<HTMLButtonElement>, text: string) => {
        e.stopPropagation();

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        navigator.clipboard
            .writeText(text)
            .then(() => {
                setIsCopied(true);
                timeoutRef.current = setTimeout(() => {
                    setIsCopied(false);
                }, 3000);
            })
            .catch((error) => {
                console.error('Failed to copy to clipboard', error);
            });
    };

    const fetchPrompt = async () => {
        try {
            const response = await appAgentApi.getPrompt<PromptType>(params.promptId!);

            form.reset({
                name: response?.name || '',
                description: response?.description || '',
                prompt: response?.prompt || '',
                isPrivate: response?.isPrivate || false,
                isPublished: response?.isPublished || false,
            });

            setState({
                ...state,
                data: {
                    ...response,
                },
                loading: false,
                error: false,
            });
        } catch (error) {
            console.error(error);
            setState({
                ...state,
                loading: false,
                error: true,
            });
        }
    };

    useEffect(() => {
        setState({
            ...state,
            loading: true,
        });
        fetchPrompt();
    }, []);

    const handleUsePrompt = (prompt: PromptType) => {
        navigate(`/agent/${agent.slug}`, { state: { prompt: prompt.prompt } });
    };

    const handleCancelEdit = () => {
        form.reset({
            name: state?.data?.name || '',
            description: state?.data?.description || '',
            prompt: state?.data?.prompt || '',
            isPrivate: state?.data?.isPrivate || false,
            isPublished: state?.data?.isPublished || false,
        });
        setEditMode('');
    };

    const creatorName = `${state?.data?.creator?.name?.first || ''} ${state?.data?.creator?.name?.last || ''}`.trim();
    const isEditing = editMode !== '';

    const renderStatusBadges = () => {
        if (isEditing) {
            return null;
        }

        return (
            <PromptStatusBadges
                isPublished={Boolean(state.data.isPublished)}
                isPrivate={Boolean(state.data.isPrivate)}
            />
        );
    };

    const renderHeaderActions = () => {
        if (isEditing) {
            return null;
        }

        return (
            <PromptHeaderActions
                canUserClone={canUserClone}
                canUserEdit={canUserEdit}
                isCopied={isCopied}
                onClone={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsConfirmationModalOpen(true);
                }}
                onEdit={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setEditMode('edit');
                }}
                onCopy={(e) => handleCopy(e, state?.data?.prompt || '')}
                onUsePrompt={() => handleUsePrompt(state?.data)}
            />
        );
    };

    const renderTitle = () => {
        if (isEditing) {
            return (
                <form.Field
                    name="name"
                    validators={{
                        onChange: ({ value }) => (!value?.trim() ? 'Name is required' : undefined),
                    }}
                    children={(field) => (
                        <Input
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="Prompt name"
                            className="h-10 rounded-xl text-xl font-normal"
                            aria-label="Prompt name"
                        />
                    )}
                />
            );
        }

        return <h1 className="line-clamp-2 text-2xl font-semibold tracking-tight">{state?.data?.name}</h1>;
    };

    const renderDescription = () => {
        if (isEditing) {
            return (
                <form.Field
                    name="description"
                    children={(field) => (
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="prompt-description" className="text-sm">
                                Description
                            </Label>
                            <TextAreaForm
                                id="prompt-description"
                                name={field.name}
                                isErrored={false}
                                placeholder="Describe what this prompt does and when to use it"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(val) => field.handleChange(val)}
                                className="max-h-60 min-h-24"
                            />
                        </div>
                    )}
                />
            );
        }

        if (!state?.data?.description) {
            return null;
        }

        return (
            <div className="flex flex-col gap-2">
                <Label className="text-sm">Description</Label>
                <div className="flex flex-col items-start gap-1 rounded-xl border border-border-secondary bg-card p-4">
                    <p
                        ref={descriptionRef}
                        className={cn(
                            'text-sm leading-6 text-text-secondary',
                            isDescriptionExpanded ? 'line-clamp-none' : 'line-clamp-2',
                        )}
                    >
                        {state?.data?.description}
                    </p>
                    {isDescriptionClamped || isDescriptionExpanded ? (
                        <button
                            type="button"
                            onClick={() => setIsDescriptionExpanded((prev) => !prev)}
                            className="text-sm font-medium text-primary hover:underline"
                        >
                            {isDescriptionExpanded ? 'Read less' : 'Read more'}
                        </button>
                    ) : null}
                </div>
            </div>
        );
    };

    const renderVisibilitySettings = () => {
        if (!isEditing) {
            return null;
        }

        return <PromptVisibilitySettings form={form} />;
    };

    const renderPromptEditor = () => {
        return (
            <form.Field
                name="prompt"
                children={(field) => (
                    <div className="prompt-editor-shell h-[min(480px,60svh)] overflow-hidden rounded-xl border border-border-secondary bg-background transition-colors focus-within:border-primary">
                        <InstructionsEditor
                            value={field.state.value || ''}
                            onChange={(val) => field.handleChange(val)}
                            placeholder="Write your prompt..."
                            enableMentions={false}
                            onBlur={field.handleBlur}
                            className="h-full rounded-none border-0 bg-transparent"
                            contentClassName="h-full"
                            editorClassName="h-full scrollbar-controller scrollbar-vertical outline-none p-4"
                        />
                    </div>
                )}
            />
        );
    };

    const renderPromptPanel = () => {
        if (isEditing) {
            return (
                <div className="flex flex-col gap-2">
                    <Label className="text-sm">Prompt content</Label>
                    {renderPromptEditor()}
                </div>
            );
        }

        return <PromptViewer prompt={state?.data?.prompt || ''} />;
    };

    if (state.loading) {
        return <PromptDetailLoading />;
    }

    if (state.error) {
        return (
            <PromptDetailError
                onRetry={() => {
                    setState((prevState) => ({
                        ...prevState,
                        loading: true,
                        error: false,
                    }));
                    void fetchPrompt();
                }}
            />
        );
    }

    return (
        <div className="prompt-detail-wrapper mx-auto flex h-fit w-full max-w-[928px] flex-col gap-8 px-4 pt-4 pb-8 max-lg:pt-[50px]">
            <div className="prompt-detail-header flex flex-wrap items-center justify-between gap-3">
                {isEditing ? (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="w-fit rounded-full px-2 text-text-secondary hover:text-primary"
                        onClick={handleCancelEdit}
                        disabled={isSubmitting}
                    >
                        <ArrowLeftIcon className="size-4" />
                        Back
                    </Button>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-fit rounded-full px-2 text-text-secondary hover:text-primary"
                        asChild
                    >
                        <Link to={`/agent/${agent.slug}/prompt-library`}>
                            <ArrowLeftIcon className="size-4" />
                            All prompts
                        </Link>
                    </Button>
                )}
                {isEditing ? (
                    <Button size="sm" className="rounded-full" onClick={form.handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <SpinnerBlade className="scale-75" /> : <CheckIcon className="size-3.5" />}
                        {editMode === 'clone' ? 'Save copy' : 'Save'}
                    </Button>
                ) : null}
                {renderHeaderActions()}
            </div>

            <div className="prompt-detail-content flex flex-col gap-6">
                <div className="prompt-detail-content-header flex flex-wrap items-start justify-between gap-4">
                    <div className="prompt-detail-content-header-title flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            {renderTitle()}
                            {renderStatusBadges()}
                        </div>
                        {!isEditing ? (
                            <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                                {creatorName ? <span>{`by ${creatorName}`}</span> : null}
                                {creatorName && state.data.updatedAt ? <span aria-hidden>·</span> : null}
                                {state.data.updatedAt ? (
                                    <span>{`Updated ${formatShortDate(state.data.updatedAt)}`}</span>
                                ) : null}
                            </div>
                        ) : (
                            <span className="text-sm text-text-secondary">
                                {editMode === 'clone' ? 'Creating a copy of this prompt' : 'Editing prompt details'}
                            </span>
                        )}
                    </div>
                </div>

                {renderDescription()}
                {renderVisibilitySettings()}
                {renderPromptPanel()}
            </div>
            <PromptCloneConfirmationModal
                isOpen={isConfirmationModalOpen}
                onClose={closeConfirmModal}
                onConfirm={onConfirmClick}
            />
        </div>
    );
};

export default PromptDetail;
