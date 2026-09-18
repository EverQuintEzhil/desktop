import SearchInput from '@/components/search-input';
import { cn } from '@/lib/utils';

import { STICKY_TAB_SEARCH_CLASS_NAME } from '../constants';

export interface Props {
    search: string;
    onChange: (next: string) => void;
    placeholder: string;
    className?: string;
}

const ChatsSearchBar = ({ search, onChange, placeholder, className }: Props) => (
    <div className={cn(className, STICKY_TAB_SEARCH_CLASS_NAME)}>
        <SearchInput
            search={search}
            onChange={onChange}
            searchOnChange
            debounceWait={400}
            autoFocus={false}
            // Switching tabs unmounts this input, which would otherwise drop a term typed inside
            // the debounce window.
            flushOnUnmount
            placeholder={placeholder}
            inputClassName="rounded-2xl border-0 shadow-surface h-11"
        />
    </div>
);

export default ChatsSearchBar;
