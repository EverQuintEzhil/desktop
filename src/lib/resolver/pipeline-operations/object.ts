import Resolver from '../resolver';

export interface ObjectOptions {
    object?: unknown;
    method: string;
}

const object = (data: unknown, option: ObjectOptions) => {
    const obj = Resolver(data, option.object);
    const objectOperations = Object as unknown as Record<string, (value: unknown) => unknown>;

    return objectOperations[option.method](obj);
};

export default object;
