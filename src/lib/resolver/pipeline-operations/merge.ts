import { merge } from 'lodash';

import Resolver from '../resolver';

const Merge = (data: unknown, options: unknown): unknown => {
    if (Array.isArray(options)) {
        const resolvedArray = options.map((each) => Resolver(data, each));

        return (merge as (...args: unknown[]) => unknown)(...resolvedArray);
    }

    return null;
};

export default Merge;
