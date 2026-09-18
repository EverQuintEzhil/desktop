/**
 * Strips keys whose value is `undefined`, so a partial payload can be merged over a fuller one
 * without erasing it. Endpoints differ in what they resolve — a single-resource GET commonly
 * returns less than the list it came from — and there an absent field means "unknown here",
 * not "empty". Values that are explicitly `null` are kept: those are answers, not gaps.
 */
const definedFieldsOf = <T extends object>(value: T): Partial<T> =>
    Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as Partial<T>;

export default definedFieldsOf;
