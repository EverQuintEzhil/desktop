import { ChevronRightIcon, FrownIcon, GlobeIcon, PlusIcon, ShieldIcon } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';

import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import SearchInput from '@/components/search-input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Switch from '@/components/ui/switch';
import useInfiniteScroll from '@/hooks/use-infinite-scroll';
import type { ChatAgentType, PromptType } from '@/types/admin';

import AgentTitlePrefix from '../agent-title-prefix';
import usePromptLibrary from '../hooks/use-prompt-library';
import useStickyHeader from '../hooks/use-sticky-header';

import { AddPrompt } from './components';
import './prompt-library.scss';

interface Props {
    agent: ChatAgentType;
}

const PromptLibrary = (props: Props) => {
    const { agent } = props;
    const params = useParams();
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');
    const [isMineOnly, setIsMineOnly] = useState(false);

    const [isAddOpen, setIsAddOpen] = useState(false);

    const listRef = useRef<HTMLUListElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const isSticky = useStickyHeader(containerRef);
    const { state, fetchNextPage, hasNextPage, addPrompt } = usePromptLibrary({
        agent,
        searchQuery,
        isMineOnly,
    });

    const onShowMore = useCallback(() => {
        if (hasNextPage) fetchNextPage();
    }, [fetchNextPage, hasNextPage]);

    const { loadMoreRef } = useInfiniteScroll({
        loading: state.loading,
        showMoreLoading: state.showMoreLoading,
        hasMore: Boolean(hasNextPage) && !searchQuery.trim(),
        itemsLength: state.data.length,
        onLoadMore: onShowMore,
    });

    const handleUsePrompt = (prompt: PromptType) => {
        navigate(`/agent/${agent.slug}`, { state: { prompt: prompt.prompt } });
    };

    const renderList = () => {
        if (state.loading) {
            return (
                <ul className="prompt-list mx-auto grid w-full max-w-[928px] list-none grid-cols-[repeat(auto-fill,minmax(255px,1fr))] gap-4 px-4 pt-2">
                    {[...Array(3)].map((_, index) => (
                        <li key={`skeleton-${index}`} className="prompt-item px-6 py-8">
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-[18px] w-4/5 rounded-sm" />
                                <div className="my-6 flex flex-col gap-2">
                                    <Skeleton className="h-4 w-4/5 rounded-sm" />
                                    <Skeleton className="h-4 w-1/2 rounded-sm" />
                                </div>
                                <Skeleton className="h-6 w-[120px] rounded-sm" />
                            </div>
                        </li>
                    ))}
                </ul>
            );
        }
        if (state.error) {
            return (
                <div className="flex items-center justify-center">
                    <span className="text-sm">Error Occurred</span>
                </div>
            );
        }
        if (state.data.length === 0) {
            return (
                <div className="mx-auto flex min-h-[calc(70svh-100px)] w-full max-w-[810px] flex-1 flex-col items-center justify-center gap-6 text-center">
                    <FrownIcon className="size-16 text-primary" />
                    <div className="flex w-full max-w-sm flex-col items-center justify-center gap-2">
                        <span className="leading-[20px] text-text-secondary">
                            {searchQuery.trim() ? 'No prompts found' : 'No prompts yet'}
                        </span>
                    </div>
                </div>
            );
        }
        const path = 'chat';

        return (
            <ul
                className="prompt-list mx-auto grid w-full max-w-[928px] list-none grid-cols-[repeat(auto-fill,minmax(255px,1fr))] gap-4 px-4 pt-2"
                ref={listRef}
            >
                {state.data.map((prompt) => (
                    <li
                        className={`prompt-item ${params['*'] === `${path}/${prompt._id}` ? 'active' : ''}`}
                        key={prompt._id}
                    >
                        <Link to={`/agent/${agent.slug}/prompt-library/${prompt._id}`} className="h-full no-underline">
                            <div className="prompt-link flex h-full w-full flex-col px-6 py-8">
                                {!prompt.isPublished && <span className="ml-auto text-xs">Draft</span>}
                                <h4 className="line-clamp-2 text-xl font-semibold text-primary">{prompt.name}</h4>
                                <div className="my-6 flex flex-col gap-2">
                                    <span className="line-clamp-2 text-sm">{prompt.description}</span>
                                    <span className="text-sm">
                                        {`${prompt.creator.name.first} ${prompt.creator.name.last}`}
                                    </span>
                                </div>
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="use-prompt-button h-auto self-start p-0! font-medium"
                                    onClick={(e: React.MouseEvent) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleUsePrompt(prompt);
                                    }}
                                >
                                    <span className="font-medium text-primary">Use Prompt</span>
                                    <ChevronRightIcon />
                                </Button>
                            </div>
                        </Link>
                    </li>
                ))}
                {!searchQuery.trim() && (
                    <InfiniteScrollTrigger
                        loadMoreRef={loadMoreRef}
                        isLoading={state.showMoreLoading}
                        hasMore={Boolean(hasNextPage)}
                    />
                )}
            </ul>
        );
    };

    const renderAdd = () => {
        return (
            <AddPrompt
                isOpen={isAddOpen}
                onClose={() => {
                    setIsAddOpen(false);
                }}
                onAddPrompt={(prompt: PromptType) => {
                    addPrompt(prompt);
                    setIsAddOpen(false);
                }}
                agent={agent}
            />
        );
    };

    return (
        <div ref={containerRef} className="prompts-container flex h-fit w-full flex-col bg-background max-lg:pt-[50px]">
            <div className={`prompts-header pt-8 pb-4 ${isSticky ? 'sticky' : ''}`}>
                <div className="inner-container mx-auto flex w-full max-w-[928px] flex-col gap-4 px-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="prompts-header-title flex min-w-0 items-center gap-1.5">
                            <AgentTitlePrefix agent={agent} />
                            <h2 className="shrink-0 text-xl font-bold">Prompt Library</h2>
                        </div>
                        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
                            <Button
                                size="sm"
                                variant="secondary"
                                className="rounded-full"
                                onClick={() => {
                                    setIsAddOpen(true);
                                }}
                            >
                                <PlusIcon />
                                Create a New Prompt
                            </Button>

                            <Switch
                                options={[
                                    { label: 'My', icon: ShieldIcon },
                                    { label: 'All', icon: GlobeIcon },
                                ]}
                                activeIndex={isMineOnly ? 0 : 1}
                                onChange={(_: unknown, index: number) => {
                                    const newIsMineOnly = index === 0;

                                    setIsMineOnly(newIsMineOnly);
                                }}
                                isLoading={state.loading}
                                color="primary"
                                width={78}
                                className="h-8! min-h-8! [&_.active-indicator]:h-8! [&_.switch-item]:min-h-8!"
                            />
                        </div>
                    </div>
                    <SearchInput
                        search={searchQuery}
                        autoFocus
                        searchOnChange
                        onChange={(value) => {
                            setSearchQuery(value);
                        }}
                        placeholder="Search prompts..."
                        className="max-w-full"
                        inputClassName="rounded-3xl border-0 shadow-surface text-base h-[45px]"
                    />
                </div>
            </div>
            <div className="prompts-content pb-6">{renderList()}</div>
            {renderAdd()}
        </div>
    );
};

export default PromptLibrary;
