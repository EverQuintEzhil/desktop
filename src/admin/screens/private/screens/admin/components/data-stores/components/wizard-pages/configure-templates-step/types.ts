export interface Template {
    templateKey: string;
    refName: string;
    name: string;
    description: string;
    code: string;
    parameters: Record<string, unknown>;
}

export type TemplatesState = {
    data: null | Template[];
    loading: boolean;
    error: boolean;
};

export const TEMPLATE_KEY_COLORS: Record<string, string> = {
    find: 'template-key-find',
    findOne: 'template-key-findone',
    insertOne: 'template-key-insert',
    updateOne: 'template-key-update',
    deleteOne: 'template-key-delete',
    aggregate: 'template-key-aggregate',
};
