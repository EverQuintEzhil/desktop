import { SearchXIcon } from 'lucide-react';

export interface Props {
    search: string;
    /** Names what did not match, e.g. "chats" or "shared chats". */
    subject: string;
}

const ChatsSearchEmpty = ({ search, subject }: Props) => (
    <div className="chats-search-empty flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-border-secondary bg-card p-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <SearchXIcon className="size-6" />
        </span>
        <span className="text-sm font-medium">No matching chats</span>
        <span className="max-w-sm text-sm text-text-secondary">{`No ${subject} in this space match "${search}".`}</span>
    </div>
);

export default ChatsSearchEmpty;
