export type EmbeddingJobType = {
    id: string;
    _id?: string;
    dag_id: string;
    status: string;
    triggered_at: string;
    started_at: string;
    finished_at: string;
    source: {
        type: string;
        api_key: {
            id: string;
            name: string;
        };
    };
    created_at: string;
    updated_at: string;
};
