import Resolver from '../../resolver';

import Types from './types';

const min = (data: unknown, properties: unknown) => {
    const props = properties as Record<string, unknown>;
    const types = Types as Record<string, (arr: unknown) => unknown>;
    let tempArray;

    if (Array.isArray(properties) && properties.length > 0) {
        tempArray = properties.map((item) => Resolver(data, item));
    } else if (props.array) {
        tempArray = Resolver(data, props.array);
    } else {
        tempArray = Resolver(data, properties);
    }
    if (Array.isArray(tempArray) && tempArray.length > 0) {
        const type = props.type as string;

        if (props.type && types[type.toLowerCase()]) {
            return types[type.toLowerCase()](tempArray);
        }

        return Math.min(...tempArray);
    }

    return null;
};

export default min;
