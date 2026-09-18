import { createContext, useContext, type ReactNode } from 'react';

export const CITATION_HREF_SUFFIX = '#fm-cite';

export interface CitationSource {
    url: string;
    title: string;
    siteName: string;
    description?: string;
    faviconUrl?: string;
}

const CitationSourcesContext = createContext<ReadonlyMap<string, CitationSource>>(new Map());

interface CitationSourcesProviderProps {
    sources: ReadonlyMap<string, CitationSource>;
    children: ReactNode;
}

export const CitationSourcesProvider = ({ sources, children }: CitationSourcesProviderProps) => (
    <CitationSourcesContext.Provider value={sources}>{children}</CitationSourcesContext.Provider>
);

export const useCitationSource = (url: string): CitationSource | undefined =>
    useContext(CitationSourcesContext).get(url);
