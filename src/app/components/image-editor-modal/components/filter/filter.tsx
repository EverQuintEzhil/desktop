import clamp from 'lodash/clamp';
import { Fragment } from 'react';

import { useEditorContext } from '../../context/editor-context';
import { useFilterThumbnails } from '../../hooks/use-filter-thumbnails';
import IntensityControl from '../intensity-control';

import { BASIC_FILTERS } from './basic-filters';
import { LUT_FILTERS } from './lut-filters';
import './filter.scss';
interface FilterProps {
    imageUrl: string;
    handleSelectFilterId: (filterId: string | null) => void;
    recordSnapshot: () => void;
}

const Filter = (props: FilterProps) => {
    const { imageUrl, handleSelectFilterId, recordSnapshot } = props;
    const { filterIntensity, setFilterIntensity, selectedFilterId } = useEditorContext();

    const { getThumbnailUrl, isLoading } = useFilterThumbnails(imageUrl, BASIC_FILTERS, LUT_FILTERS);

    const isBasicFilter = selectedFilterId ? BASIC_FILTERS.some((f) => f.id === selectedFilterId) : false;
    const isLutFilter = selectedFilterId ? LUT_FILTERS.some((f) => f.id === selectedFilterId) : false;

    const handleIntensityChange = (value: number) => {
        if (isBasicFilter) {
            setFilterIntensity(clamp(value, -100, 100));
        } else if (isLutFilter) {
            setFilterIntensity(clamp(value, 0, 100));
        } else {
            setFilterIntensity(value);
        }
    };

    const renderIntensityControl = (filterId: string | null) => {
        if (!filterId || selectedFilterId !== filterId) return null;

        const isBasic = BASIC_FILTERS.some((f) => f.id === filterId);
        const isLut = LUT_FILTERS.some((f) => f.id === filterId);

        if (isBasic) {
            return (
                <div className="filter-intensity-row -mt-4 w-full">
                    <IntensityControl
                        label="Intensity"
                        value={filterIntensity}
                        min={-100}
                        max={100}
                        pattern="-?[0-9]*"
                        allowedPattern={/^-?\d*$/}
                        onChange={handleIntensityChange}
                        onSliderStart={recordSnapshot}
                        onEditStart={recordSnapshot}
                        wrapperClassName="filter-item-controls flex items-center justify-between gap-3 p-2 w-full"
                        sliderWrapperClassName="filter-inputs flex items-center gap-3 flex-1"
                        numberClassName="filter-number min-w-[60px]"
                        rangeClassName="filter-range flex-1"
                        ariaLabelNumber="Filter intensity"
                        ariaLabelSlider="Filter intensity slider"
                    />
                </div>
            );
        }

        if (isLut) {
            return (
                <div className="filter-intensity-row -mt-4 w-full">
                    <IntensityControl
                        label="Intensity"
                        value={filterIntensity}
                        min={0}
                        max={100}
                        pattern="[0-9]*"
                        allowedPattern={/^\d*$/}
                        onChange={handleIntensityChange}
                        onSliderStart={recordSnapshot}
                        onEditStart={recordSnapshot}
                        wrapperClassName="filter-item-controls flex items-center justify-between gap-3 p-2 w-full"
                        sliderWrapperClassName="filter-inputs flex items-center gap-3 flex-1"
                        numberClassName="filter-number min-w-[60px]"
                        rangeClassName="filter-range flex-1"
                        ariaLabelNumber="Filter intensity"
                        ariaLabelSlider="Filter intensity slider"
                    />
                </div>
            );
        }

        return null;
    };

    const renderFilterThumbnail = (filter: { id: string; label: string; dataCy: string }) => {
        const thumbnailUrl = getThumbnailUrl(filter.id);
        const loading = isLoading(filter.id);
        const isActive = selectedFilterId === filter.id;

        return (
            <li key={filter.id} className="filter-card flex flex-col gap-2">
                <div className="filter-item-wrapper flex flex-col gap-1.5">
                    <button
                        type="button"
                        className={`filter-item h-[90px] p-0 ${isActive ? 'active' : ''} ${loading ? 'bg-gray-200' : 'bg-white'}`}
                        style={thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})` } : undefined}
                        onClick={() => handleSelectFilterId(filter.id)}
                        data-cy={filter.dataCy}
                        aria-label={`Select filter ${filter.label}`}
                    >
                        {loading && <div className="filter-loading flex items-center justify-center">Loading...</div>}
                    </button>
                    <div className={`filter-label px-1 ${isActive ? 'active' : ''}`}>
                        <span className="text-xs font-medium text-text-secondary">{filter.label}</span>
                    </div>
                </div>
            </li>
        );
    };

    const allFilters = [...BASIC_FILTERS, ...LUT_FILTERS];
    const filterPairs: Array<[(typeof allFilters)[0], (typeof allFilters)[0] | null]> = [];

    for (let i = 0; i < allFilters.length; i += 2) {
        filterPairs.push([allFilters[i], allFilters[i + 1] || null]);
    }

    return (
        <div className="filter-wrapper panel-section filter-panel flex flex-col px-4">
            <div className="filter-list grid grid-cols-2 gap-x-4 gap-y-6">
                {filterPairs.map((pair, pairIndex) => {
                    const [filter1, filter2] = pair;
                    const isFilter1Selected = selectedFilterId === filter1.id;
                    const isFilter2Selected = selectedFilterId === filter2?.id;
                    const hasSelectedInPair = isFilter1Selected || isFilter2Selected;

                    return (
                        <Fragment key={`pair-${pairIndex}`}>
                            {renderFilterThumbnail(filter1)}
                            {filter2 && renderFilterThumbnail(filter2)}

                            {hasSelectedInPair &&
                                renderIntensityControl(isFilter1Selected ? filter1.id : filter2?.id || null)}
                        </Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default Filter;
