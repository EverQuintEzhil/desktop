import Resolver from '../resolver';

export interface SpliceProperties {
    array?: unknown;
    index?: unknown;
}

const splice = (data: unknown, properties?: SpliceProperties) => {
    if (properties?.array) {
        let resolvedIndex = 0;

        if (properties.index) {
            resolvedIndex = Resolver(data, properties.index);
        }
        if (Array.isArray(properties.array)) {
            const tempArray = (properties as { slice: () => unknown[] }).slice();
            const splicedArray = tempArray.splice(0, resolvedIndex);

            return splicedArray;
        }
        const array = Resolver(data, properties.array);

        if (Array.isArray(array) && array.length > 0) {
            const tempArray = array.slice();
            const splicedArray = tempArray.splice(0, resolvedIndex);

            return splicedArray;
        }
    }

    return null;
};

export default splice;
