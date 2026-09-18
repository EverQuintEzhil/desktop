import Arithmetic from '../../arithmetic/operators';

import and from './and';
import eq from './eq';
import every from './every';
import ifFn from './if';
import inFn from './in';
import isEmpty from './is-empty';
import isJSON from './is-json';
import isNotEmpty from './is-not-empty';
import isValidValue from './is-valid-value';
import nin from './nin';
import or from './or';
import regex from './regex';
import some from './some';

const Operators = {
    ...Arithmetic,
    '==': (a: unknown, b: unknown) => a == b,
    '===': (a: unknown, b: unknown) => a === b,
    '!=': (a: unknown, b: unknown) => a != b,
    '!==': (a: unknown, b: unknown) => a !== b,
    '>': (a: unknown, b: unknown) => (a as number) > (b as number),
    '<': (a: unknown, b: unknown) => (a as number) < (b as number),
    '>=': (a: unknown, b: unknown) => (a as number) >= (b as number),
    '<=': (a: unknown, b: unknown) => (a as number) <= (b as number),
    '!!': (a: unknown) => !!a,
    '!': (a: unknown) => !a,
    some,
    every,
    and,
    eq,
    in: inFn,
    empty: isEmpty,
    notEmpty: isNotEmpty,
    isValidValue,
    nin,
    or,
    regex,
    isJSON,
    if: ifFn,
};

export default Operators;
