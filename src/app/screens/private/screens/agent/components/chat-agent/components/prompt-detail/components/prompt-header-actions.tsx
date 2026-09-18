import { CheckIcon, CopyIcon, PencilIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface Props {
    canUserClone: boolean;
    canUserEdit: boolean;
    isCopied: boolean;
    onClone: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onEdit: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onCopy: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onUsePrompt: () => void;
}

const PromptHeaderActions = (props: Props) => {
    const { canUserClone, canUserEdit, isCopied, onClone, onEdit, onCopy, onUsePrompt } = props;

    return (
        <div className="prompt-detail-header-actions ml-auto flex flex-wrap items-center justify-end gap-2">
            {canUserClone ? (
                <Button size="sm" variant="ghost" className="rounded-full px-4" onClick={onClone}>
                    <CopyIcon className="size-3.5" />
                    Clone
                </Button>
            ) : null}
            {canUserEdit ? (
                <Button size="sm" variant="outline" className="rounded-full px-4" onClick={onEdit}>
                    <PencilIcon className="size-3.5" />
                    Edit
                </Button>
            ) : null}
            <Button size="sm" variant="secondary" className="rounded-full px-4" onClick={onCopy}>
                {isCopied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                {isCopied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="sm" className="rounded-full px-4" onClick={onUsePrompt}>
                Use Prompt
            </Button>
        </div>
    );
};

export default PromptHeaderActions;
