import { RAW_LUT_FILTERS } from './lut-filters-data';

export interface LutFilterOption {
    id: string;
    label: string;
    category: string;
    lutUri: string;
    tilesX: number;
    tilesY: number;
    dataCy: string;
}

export type LutFilterOptionBase = LutFilterOption;

export const LUT_FILTERS: LutFilterOption[] = RAW_LUT_FILTERS.map((filter): LutFilterOption => ({
    ...filter,
    dataCy: `filter-${filter.id}`,
}));
