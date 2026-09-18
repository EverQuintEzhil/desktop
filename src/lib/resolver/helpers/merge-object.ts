const MergeObject = (root: Record<string, unknown>, key: string, value: unknown) => {
    root[key] = value;

    return root;
};

export default MergeObject;
