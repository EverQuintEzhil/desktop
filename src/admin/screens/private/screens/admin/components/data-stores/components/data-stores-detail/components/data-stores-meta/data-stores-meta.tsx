import { CopyButton } from '@/components';
import type { DataStoreType } from '@/types/admin';

import '../../data-stores-detail.scss';

interface Props {
    dataStore: DataStoreType;
}

const DataStoresMeta = (props: Props) => {
    const { dataStore } = props;

    return (
        <div className="metabar flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm text-text-secondary">{dataStore.name}</span>
            <span className="meta-details-dot inline-block size-1 rounded-full bg-gray-300" />
            <span className="secondary truncate text-sm">{dataStore.refName}</span>
            <CopyButton text={dataStore.refName} className="copy-button ml-0 shrink-0" />
            {dataStore?.creator?.name && (
                <>
                    <span className="meta-details-dot inline-block size-1 rounded-full bg-gray-300" />
                    <span className="text-sm text-text-secondary">
                        {`Created by ${dataStore.creator.name.first} ${dataStore.creator.name.last}`}
                    </span>
                </>
            )}
        </div>
    );
};

export default DataStoresMeta;
