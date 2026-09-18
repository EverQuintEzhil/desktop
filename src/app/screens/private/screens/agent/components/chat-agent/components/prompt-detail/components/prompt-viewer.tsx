import Markdown from '@/components/markdown';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface Props {
    prompt: string;
}

const PROMPT_VIEW_TAB_TRIGGER_CLASS_NAME = cn(
    'h-8 flex-none rounded-none px-0 text-sm font-medium text-text-secondary',
    'after:bg-primary group-data-[orientation=horizontal]/tabs:after:bottom-0!',
    'group-data-[orientation=horizontal]/tabs:after:h-px! hover:text-primary data-[state=active]:text-primary',
);

const PromptViewer = (props: Props) => {
    const { prompt } = props;

    return (
        <Tabs defaultValue="read" className="flex flex-col gap-2">
            <div className="prompt-content-tabs flex items-center justify-between gap-3">
                <Label className="text-sm">Prompt content</Label>
                <TabsList variant="line" className="gap-3 p-0">
                    <TabsTrigger value="read" className={PROMPT_VIEW_TAB_TRIGGER_CLASS_NAME}>
                        Preview
                    </TabsTrigger>
                    <TabsTrigger value="code" className={PROMPT_VIEW_TAB_TRIGGER_CLASS_NAME}>
                        Source
                    </TabsTrigger>
                </TabsList>
            </div>
            <div className="rounded-xl border border-border-secondary bg-card p-4">
                <TabsContent value="read" className="mt-0">
                    <div className="prompt-content">
                        <Markdown>{prompt}</Markdown>
                    </div>
                </TabsContent>
                <TabsContent value="code" className="mt-0">
                    <pre
                        className={cn('prompt-code-view m-0 text-sm leading-6 wrap-break-word whitespace-pre-wrap')}
                        role="presentation"
                    >
                        {prompt}
                    </pre>
                </TabsContent>
            </div>
        </Tabs>
    );
};

export default PromptViewer;
