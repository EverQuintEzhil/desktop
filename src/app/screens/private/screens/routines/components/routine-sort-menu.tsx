import { ArrowDownUpIcon } from 'lucide-react';

import { ROUTINE_SORT_OPTIONS, type RoutineSort } from '../constants';

import RoutineFilterMenu from './routine-filter-menu';

interface Props {
    sort: RoutineSort;
    onChange: (sort: RoutineSort) => void;
    /** Archived rows have no next run, so that view offers the options without it. */
    options?: typeof ROUTINE_SORT_OPTIONS;
}

const RoutineSortMenu = ({ sort, onChange, options = ROUTINE_SORT_OPTIONS }: Props) => (
    <RoutineFilterMenu value={sort} options={options} onChange={onChange} label="Sort" Icon={ArrowDownUpIcon} />
);

export default RoutineSortMenu;
