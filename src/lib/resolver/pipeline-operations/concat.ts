import Resolver from '../resolver';

const Concat = (data: unknown, options: unknown): unknown => {
    if (Array.isArray(options)) {
        return options
            .map((each: unknown) => Resolver(data, each))
            .flat()
            .filter((e) => e);
    }

    return [];
};

export default Concat;
