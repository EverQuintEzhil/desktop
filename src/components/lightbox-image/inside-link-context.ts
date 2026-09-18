import { createContext, useContext } from 'react';

export const InsideLinkContext = createContext(false);

export const useIsInsideLink = () => useContext(InsideLinkContext);
