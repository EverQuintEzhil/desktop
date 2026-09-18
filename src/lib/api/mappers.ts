import type { PageInfo, PagedList, RawPageInfo, RawPagedList } from '@/types/api-types';

export function mapPageInfo(raw: RawPageInfo): PageInfo {
    return {
        page: raw.page,
        totalPages: raw.total_pages,
        totalCount: raw.total_count,
    };
}

export function mapPagedList<T>(raw: RawPagedList<T>): PagedList<T> {
    return {
        values: raw.values,
        pageInfo: mapPageInfo(raw.page_info),
    };
}
