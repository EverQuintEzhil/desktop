export type PickerItemKind = 'mcp' | 'tool' | 'agent' | 'memory';

export interface PickerItem {
    _id: string;
    name: string;
    description?: string;
    serverUrl?: string;
    creatorId?: string;
    kind: PickerItemKind;
}

const ITEM_COLOR_PALETTE = ['#4285F4', '#0F9D58', '#EA4335', '#4A154B', '#24292e', '#6264A7', '#0078D4', '#7048ff'];

export const getItemAbbr = (name: string): string => {
    const words = name.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
        const initials = words[0][0] + words[1][0];

        return initials
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .slice(0, 2);
    }

    const alphanum = name.replace(/[^a-zA-Z0-9]/g, '');

    return alphanum.toUpperCase().slice(0, 2) || '??';
};

export const getItemColor = (id: string): string => {
    let hash = 0;

    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }

    return ITEM_COLOR_PALETTE[hash % ITEM_COLOR_PALETTE.length];
};

export const actionBase =
    'h-11 w-full border-0 rounded-[14px] text-h6 font-semibold cursor-pointer' +
    ' bg-primary text-white transition-[background,opacity,transform] duration-140' +
    ' mt-auto shrink-0 hover:opacity-[0.92] hover:-translate-y-px' +
    ' disabled:opacity-[0.38] disabled:cursor-not-allowed';
export const actionRemove =
    'bg-(--surface) text-(--danger)' + ' border border-[color-mix(in_srgb,var(--danger)_22%,var(--border))]';

export const panelBtnCls =
    'rounded-xl text-text-secondary hover:text-primary hover:bg-[color-mix(in_srgb,var(--primary)_7%,var(--surface))]';

export const pickerDialogCls =
    'flex p-0 rounded-3xl overflow-hidden w-full' +
    ' bg-(--surface) sm:max-w-[min(1200px,calc(100vw-64px))]! h-[min(820px,calc(100vh-64px))]!' +
    ' border border-[color-mix(in_srgb,var(--border)_78%,var(--primary))]' +
    ' shadow-[0_24px_80px_color-mix(in_srgb,var(--neutral-dark)_18%,transparent)]';

export const pickerFormWrapCls = 'mx-auto w-full';

export const nameToRefName = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9_ ]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
