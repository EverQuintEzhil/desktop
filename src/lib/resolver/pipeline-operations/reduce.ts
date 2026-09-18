import Resolver from '../resolver';

export interface ReduceOptions {
    array?: unknown;
    object?: unknown;
    constants?: unknown;
    value?: unknown;
    initialValue?: unknown;
}

const Reduce = (data: unknown, options: ReduceOptions, originalData: object = {}): unknown => {
    if (!Array.isArray(data) && !options.array && !options.object) {
        return null;
    }
    const constants = options.constants ? Resolver(data, options.constants) : {};
    let arr: unknown = data;

    if (options.array) {
        arr = Resolver(data, options.array);
    }
    if (options.object) {
        const object = Resolver(data, options.object);

        arr = Object.keys(object);
    }
    if (!Array.isArray(arr)) {
        return null;
    }

    return arr.reduce(
        (accumulator: unknown, each: unknown) =>
            Resolver(
                {
                    ...originalData,
                    each,
                    constants,
                    accumulator,
                },
                options.value,
            ),
        options.initialValue,
    );
};

export default Reduce;
