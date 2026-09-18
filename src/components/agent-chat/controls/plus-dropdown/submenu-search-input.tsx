import { useEffect, useRef } from 'react';

interface Props {
    search: string;
    setSearch: (value: string) => void;
    placeholder?: string;
}

// Mirrors the spaces submenu search: stopPropagation keeps the dropdown's
// type-ahead from hijacking keystrokes; the delayed focus wins the race with
// the menu's own focus management when the submenu opens.
const SubmenuSearchInput = ({ search, setSearch, placeholder = 'Search' }: Props) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (inputRef.current) inputRef.current.focus();
        }, 50);

        return () => clearTimeout(timer);
    }, []);

    return (
        <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={placeholder}
            className="w-full bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        />
    );
};

export default SubmenuSearchInput;
