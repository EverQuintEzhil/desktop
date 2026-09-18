import Resolver from '../resolver';

export interface MapOptions {
    array?: unknown;
    constants?: unknown;
    object?: unknown;
}

const Map = (data: unknown, options: MapOptions, originalData: object = {}): unknown => {
    if (!Array.isArray(data) && !options.array) {
        return null;
    }
    const constants = options.constants ? Resolver(data, options.constants) : {};
    const arr = options.array ? Resolver(data, options.array) : data;

    if (!Array.isArray(arr)) {
        return null;
    }
    const object = options.object || options;

    return arr.map((each: unknown) => Resolver({ ...originalData, each, constants }, object));
};

export default Map;
