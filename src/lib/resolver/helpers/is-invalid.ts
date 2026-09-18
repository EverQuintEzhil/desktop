const IsInvalid = (value: unknown) => typeof value === 'undefined' || value === undefined || value === null;

export default IsInvalid;
