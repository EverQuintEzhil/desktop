import { HistoryIcon } from 'lucide-react';
import { useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useViewportFillHeight } from '@/hooks';
import type { AgentType } from '@/types/admin';
import { hasGalleryUi } from '@/types/ui';

import { GalleryHistory, Histories } from './components';

interface Props {
    agent: AgentType;
}

const AgentHistories = (props: Props) => {
    const { agent } = props;

    const rootRef = useRef<HTMLDivElement>(null);

    useViewportFillHeight(rootRef, { cssVar: '--agent-histories-h' });

    if (!hasGalleryUi(agent)) {
        return null;
    }

    return (
        <div
            ref={rootRef}
            className="tab-content histories-tab flex h-(--agent-histories-h,calc(100svh-48px-83px)) min-h-0 flex-col"
        >
            <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel
                    minSize="20%"
                    defaultSize="20%"
                    maxSize="30%"
                    className="scrollbar-controller scrollbar-vertical scrollbar-horizontal relative"
                >
                    <Histories agent={agent} />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize="80%">
                    <Routes>
                        <Route
                            path=""
                            element={
                                <div className="no-history flex h-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
                                    <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                                        <HistoryIcon className="size-10" />
                                    </div>
                                    <div className="flex max-w-sm flex-col items-center gap-1.5">
                                        <span className="text-base font-medium text-foreground">
                                            Select a history item
                                        </span>
                                        <span className="text-sm leading-5 text-muted-foreground">
                                            Choose an item from the list on the left to view its generation details and
                                            media.
                                        </span>
                                    </div>
                                </div>
                            }
                        />
                        <Route
                            path=":historyId"
                            element={<GalleryHistory isVideo={agent.uiConfig.type === 'video'} />}
                        />
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
};

export default AgentHistories;
