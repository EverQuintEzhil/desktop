export interface BasicFilterOption {
    id: string;
    label: string;
    dataCy: string;
    duotone: {
        darkColor: string; // Hex color string (e.g. "#cb2129")
        lightColor: string; // Hex color string (e.g. "#e1de9a")
    };
}

// Duotone/basic filter presets.
export const BASIC_FILTERS: BasicFilterOption[] = [
    {
        id: 'filter.duotone/desert',
        label: 'Desert',
        dataCy: 'filter.duotone/desert',
        duotone: {
            darkColor: '#cb2129',
            lightColor: '#e1de9a',
        },
    },
    {
        id: 'filter.duotone/peach',
        label: 'Peach',
        dataCy: 'filter.duotone/peach',
        duotone: {
            darkColor: '#0040ff',
            lightColor: '#e9abb8',
        },
    },
    {
        id: 'filter.duotone/clash',
        label: 'Clash',
        dataCy: 'filter.duotone/clash',
        duotone: {
            darkColor: '#23007c',
            lightColor: '#f41a0f',
        },
    },
    {
        id: 'filter.duotone/plum',
        label: 'Plum',
        dataCy: 'filter.duotone/plum',
        duotone: {
            darkColor: '#23007c',
            lightColor: '#74d7ff',
        },
    },
    {
        id: 'filter.duotone/breezy',
        label: 'Breezy',
        dataCy: 'filter.duotone/breezy',
        duotone: {
            darkColor: '#c20000',
            lightColor: '#68fdff',
        },
    },
    {
        id: 'filter.duotone/deepblue',
        label: 'Deep Blue',
        dataCy: 'filter.duotone/deepblue',
        duotone: {
            darkColor: '#58007c',
            lightColor: '#2de9eb',
        },
    },
    {
        id: 'filter.duotone/frog',
        label: 'Frog',
        dataCy: 'filter.duotone/frog',
        duotone: {
            darkColor: '#7f23a9',
            lightColor: '#5bff60',
        },
    },
    {
        id: 'filter.duotone/sunset',
        label: 'Sunset',
        dataCy: 'filter.duotone/sunset',
        duotone: {
            darkColor: '#c400be',
            lightColor: '#f8ea46',
        },
    },
];
