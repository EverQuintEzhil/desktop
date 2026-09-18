import { set } from 'lodash';

import Condition from '../condition';
import Operators from '../condition/operators';
import { GetByPath } from '../helpers';
import Resolver from '../resolver';

export interface FilterOptions {
    array?: string;
    query?: Record<string, unknown>;
    condition?: unknown;
    replaceRoot?: boolean;
}

const Filter = (data: unknown, options: FilterOptions): unknown => {
    if (!Array.isArray(data) && !options.array) {
        return null;
    }
    const arr = options.array ? Resolver(data, options.array) : data;

    if (!arr) {
        return null;
    }

    let results: unknown[] = [];
    const { query, condition } = options;

    if (query) {
        results = arr.filter((el: unknown) =>
            Object.entries(query).every(([property, propertyValue]) => {
                const keyValue = GetByPath(el, property);

                const value =
                    typeof propertyValue === 'string' && propertyValue.indexOf('$data.') !== -1
                        ? GetByPath(el, propertyValue)
                        : propertyValue;
                const valueRecord = value as Record<string, unknown>;

                if (valueRecord.in) {
                    return Operators.in(keyValue, valueRecord.in);
                }
                if (valueRecord.nin) {
                    return Operators.nin(keyValue, Resolver(data, valueRecord.nin));
                }
                if (valueRecord.isEmpty) {
                    return Operators.empty(keyValue);
                }

                return Operators.eq(keyValue, value);
            }),
        );
    } else if (condition) {
        results = arr.filter((el: unknown) =>
            Condition(
                {
                    ...(data as object),
                    each: el,
                },
                condition,
            ),
        );
    }
    if (options.array && options.replaceRoot !== false) {
        return set(data as object, options.array.replace('$data.', ''), results);
    }

    return results;
};

export default Filter;
