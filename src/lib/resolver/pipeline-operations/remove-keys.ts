import { omit } from 'lodash';

const RemoveKeys = (data: unknown, options: string | string[]): unknown => {
    if (Array.isArray(data)) {
        return data.map((item: unknown) => RemoveKeys(item, options));
    }

    return omit(data as Record<string, unknown>, options);
};

export default RemoveKeys;
