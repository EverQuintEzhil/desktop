import { DS_COLOR_PALETTE } from '../constants';

export const getDataStoreColor = (id: string): string => {
    let hash = 0;

    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }

    return DS_COLOR_PALETTE[hash % DS_COLOR_PALETTE.length];
};
