import type { CSSProperties } from 'react';

import { readBuilderChatWidth } from '../hooks/use-builder-chat-width';

const CreateAgentEditorSkeleton = () => (
    <div
        className="flex min-h-screen"
        style={{ '--builder-chat-width': `${readBuilderChatWidth()}px` } as CSSProperties}
    >
        {/* chat aside */}
        <aside className="sticky top-0 flex h-screen w-full shrink-0 flex-col overflow-hidden bg-background md:w-(--builder-chat-width)">
            {/* aside topbar */}
            <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border px-4">
                <div className="h-8 w-40 rounded-md bg-foreground/10" />
                <div className="ml-auto size-8 rounded-md bg-foreground/10" />
            </div>

            {/* empty-state suggestions pinned to bottom */}
            <div className="flex flex-1 flex-col justify-end p-4">
                <div className="mb-5 h-4 w-52 rounded bg-foreground/10" />
                <div className="flex flex-col gap-0.5">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-[9px]">
                            <div className="size-3.5 shrink-0 rounded bg-foreground/10" />
                            <div className="h-3 rounded bg-foreground/10" style={{ width: `${140 + i * 22}px` }} />
                        </div>
                    ))}
                </div>
            </div>

            {/* composer */}
            <div className="shrink-0 border-t border-border p-4">
                <div className="h-[92px] rounded-2xl border border-border bg-foreground/4" />
            </div>
        </aside>

        {/* config panel */}
        <div className="flex min-w-0 flex-1 flex-col bg-card">
            {/* config topbar */}
            <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
                <div className="h-4 w-16 rounded bg-foreground/10" />
                <div className="flex items-center gap-1">
                    <div className="h-8 w-24 rounded-full bg-foreground/10" />
                    <div className="size-8 rounded-full bg-foreground/10" />
                </div>
            </div>

            {/* config body */}
            <div className="scrollbar-controller scrollbar-vertical scrollbar-horizontal px-4 py-8">
                <div className="mx-auto flex max-w-[860px] flex-col gap-8">
                    {/* agent name */}
                    <div className="h-8 w-44 rounded-lg bg-foreground/10" />

                    {/* channels */}
                    <div className="flex flex-col border-t border-border">
                        <div className="flex flex-col gap-0.5 py-8">
                            <div className="h-5 w-56 rounded bg-foreground/10" />
                            <div className="h-3.5 w-80 rounded bg-foreground/10" />
                        </div>
                        <div className="flex flex-wrap gap-4">
                            {[0, 1].map((i) => (
                                <div key={i} className="w-xs rounded-3xl border border-border p-6">
                                    <div className="size-[22px] rounded-md bg-foreground/10" />
                                    <div className="mt-3.5 h-3.5 w-40 rounded bg-foreground/10" />
                                    <div className="mt-1 h-3 w-28 rounded bg-foreground/10" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* capabilities */}
                    <div className="flex flex-col border-t border-border">
                        <div className="flex flex-col gap-0.5 py-8">
                            <div className="h-5 w-52 rounded bg-foreground/10" />
                            <div className="h-3.5 w-72 rounded bg-foreground/10" />
                        </div>
                        <div className="rounded-3xl border border-border px-6 py-2">
                            {[0, 1, 2, 3, 4, 5].map((i, _, arr) => (
                                <div
                                    key={i}
                                    className={`flex items-start gap-4 py-[18px] ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
                                >
                                    <div className="size-9 shrink-0 rounded-[10px] bg-foreground/10" />
                                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                        <div className="h-3.5 w-32 rounded bg-foreground/10" />
                                        <div
                                            className="h-3 rounded bg-foreground/10"
                                            style={{ width: `${200 + (i % 3) * 40}px` }}
                                        />
                                        <div className="mt-1 flex gap-2">
                                            <div className="h-7 w-28 rounded-full bg-foreground/10" />
                                            <div className="h-7 w-24 rounded-full bg-foreground/10" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* instructions */}
                    <div className="flex flex-col border-t border-border">
                        <div className="flex flex-col gap-0.5 py-8">
                            <div className="h-5 w-52 rounded bg-foreground/10" />
                            <div className="h-3.5 w-80 rounded bg-foreground/10" />
                        </div>
                        <div className="h-52 rounded-3xl border border-border bg-foreground/4" />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default CreateAgentEditorSkeleton;
