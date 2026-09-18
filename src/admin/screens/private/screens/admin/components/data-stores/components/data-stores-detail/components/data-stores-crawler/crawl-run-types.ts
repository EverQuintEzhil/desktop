/** Row shape of GET /datastores/wizard/:id/embedding-job/runs for weblinks stores
 *  (Postgres data_store_web_runs — not the andhadhi EmbeddingJobType shape). */
export interface WebCrawlRunStats {
    discovered?: number;
    fetched?: number;
    unchanged?: number;
    updated?: number;
    added?: number;
    deleted?: number;
    failed?: number;
}

export interface WebCrawlRunType {
    _id: string;
    workflowId: string;
    trigger: 'manual' | 'schedule' | 'create';
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    stats: WebCrawlRunStats | null;
    error: string | null;
    startedAt: string;
    finishedAt: string | null;
}
