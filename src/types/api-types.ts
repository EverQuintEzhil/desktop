export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    value: T;
}

export interface RawPageInfo {
    page: number;
    total_pages: number;
    total_count: number;
}

export interface PageInfo {
    page: number;
    totalPages: number;
    totalCount: number;
}

export interface RawPagedList<T> {
    values: T[];
    page_info: RawPageInfo;
}

export interface PagedList<T> {
    values: T[];
    pageInfo: PageInfo;
}
