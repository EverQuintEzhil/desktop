import Resolver from '../resolver';

const Base64Encode = (data: unknown, options: unknown): unknown => {
    const value = Resolver(data, options);

    if (typeof value === 'object') {
        return btoa(JSON.stringify(value));
    }

    return btoa(value);
};

export default Base64Encode;
