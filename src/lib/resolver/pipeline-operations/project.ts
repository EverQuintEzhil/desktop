const ProjectFunction = (properties: [string, unknown][], document: unknown): Record<string, unknown> => {
    const doc = document as Record<string, unknown>;

    return properties.reduce((acc: Record<string, unknown>, [field, value]) => {
        if (typeof value === 'object') {
            return {
                ...acc,
                [field]: Project(doc[field], value),
            };
        }

        return {
            ...acc,
            [field]: doc[field],
        };
    }, {});
};

const Project = (data: unknown, properties: unknown): unknown => {
    const props = Object.entries(properties as Record<string, unknown>);

    if (Array.isArray(data)) {
        return data.map((document) => ProjectFunction(props, document));
    }

    return ProjectFunction(props, data);
};

export default Project;
