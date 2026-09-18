import Resolver from '../resolver';

const reverse = (data: unknown, properties: unknown) => {
    if (properties && Array.isArray(properties)) {
        const tempArray = properties.slice();

        return tempArray.reverse();
    }
    const array = Resolver(data, properties);

    if (Array.isArray(array) && array.length > 0) {
        const tempArray = array.slice();

        return tempArray.reverse();
    }

    return null;
};

export default reverse;
