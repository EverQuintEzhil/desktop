import type React from 'react';
import { useCallback, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';

import { getTabFromSearchParams } from './gallery-media-helpers';
import type { GalleryTab } from './types';

interface UseGalleryTabAndSearchArgs {
    fixedTab: GalleryTab | undefined;
    searchParams: URLSearchParams;
    setSearchParams: SetURLSearchParams;
}

export interface UseGalleryTabAndSearchResult {
    activeTab: GalleryTab;
    setActiveTab: React.Dispatch<React.SetStateAction<GalleryTab>>;
    searchQuery: string;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
}

export const useGalleryTabAndSearch = (args: UseGalleryTabAndSearchArgs): UseGalleryTabAndSearchResult => {
    const { fixedTab, searchParams, setSearchParams } = args;

    const activeTab = fixedTab ?? getTabFromSearchParams(searchParams);
    const setActiveTab = useCallback(
        (value: React.SetStateAction<GalleryTab>) => {
            if (fixedTab) return;

            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    const newTab = typeof value === 'function' ? value(getTabFromSearchParams(prev)) : value;

                    next.set('tab', newTab);

                    return next;
                },
                { replace: true },
            );
        },
        [fixedTab, setSearchParams],
    );

    const [searchQuery, setSearchQuery] = useState('');

    return {
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
    };
};
