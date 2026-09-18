import { useMutation } from '@tanstack/react-query';
import { DownloadIcon, FileIcon, FileJson2Icon, FileTextIcon, FileType2Icon, type LucideIcon } from 'lucide-react';

import {
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import {
    appConversationApi,
    getConversationExportErrorMessage,
    type ConversationExportFormat,
    type ConversationExportParams,
} from '@/lib/api/app/conversation';
import { showErrorToast, showSuccessToast } from '@/utils';

interface Props {
    agentId: string;
    conversationId: string;
    title?: string;
}

const EXPORT_LABELS: Record<ConversationExportFormat, string> = {
    markdown: 'Markdown',
    json: 'JSON',
    pdf: 'PDF',
    docx: 'Word',
};

const EXPORT_OPTIONS: { format: ConversationExportFormat; icon: LucideIcon }[] = [
    { format: 'markdown', icon: FileTextIcon },
    { format: 'json', icon: FileJson2Icon },
    { format: 'pdf', icon: FileIcon },
    { format: 'docx', icon: FileType2Icon },
];

const ExportConversationMenu = (props: Props) => {
    const { agentId, conversationId, title } = props;

    const exportConversation = useMutation({
        mutationFn: (params: ConversationExportParams) => appConversationApi.exportConversation(params),
        onSuccess: (_result, variables) => showSuccessToast(`Chat exported as ${EXPORT_LABELS[variables.format]}`),
        onError: async (error) => showErrorToast(await getConversationExportErrorMessage(error)),
    });

    const pendingFormat = exportConversation.isPending ? exportConversation.variables.format : null;

    const renderFormatItem = ({ format, icon: Icon }: (typeof EXPORT_OPTIONS)[number]) => (
        <DropdownMenuItem
            key={format}
            className="cursor-pointer"
            disabled={exportConversation.isPending}
            onClick={(e) => {
                // Radix runs this handler before its own select handler and skips
                // that one on a default-prevented event, so `preventDefault` holds
                // the menu open long enough to show the spinner. `stopPropagation`
                // keeps the row's conversation link from navigating.
                e.stopPropagation();
                e.preventDefault();
                exportConversation.mutate({
                    conversationId,
                    agentId,
                    format,
                    title,
                });
            }}
        >
            {pendingFormat === format ? <Spinner className="size-3.5" /> : <Icon className="size-3.5" />}
            {EXPORT_LABELS[format]}
        </DropdownMenuItem>
    );

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <DownloadIcon className="size-3.5" />
                Export
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>{EXPORT_OPTIONS.map(renderFormatItem)}</DropdownMenuSubContent>
        </DropdownMenuSub>
    );
};

export default ExportConversationMenu;
