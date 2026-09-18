import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';

export interface BlogBreadcrumbEntry {
    label: string;
    to?: string;
}

export interface BlogBreadcrumbProps {
    items: BlogBreadcrumbEntry[];
    className?: string;
}

const BlogBreadcrumb = (props: BlogBreadcrumbProps) => {
    const { items, className } = props;

    const renderCrumb = (entry: BlogBreadcrumbEntry, isLast: boolean) => {
        if (isLast || !entry.to) {
            return <BreadcrumbPage className="font-medium">{entry.label}</BreadcrumbPage>;
        }

        return (
            <BreadcrumbLink asChild className="text-text-secondary! hover:text-primary!">
                <Link to={entry.to}>{entry.label}</Link>
            </BreadcrumbLink>
        );
    };

    if (items.length === 0) {
        return null;
    }

    return (
        <Breadcrumb className={cn('blog-breadcrumb', className)}>
            <BreadcrumbList>
                {items.map((entry, index) => {
                    const isLast = index === items.length - 1;

                    return (
                        <Fragment key={`${index}-${entry.label}`}>
                            <BreadcrumbItem className="min-w-0">
                                <span className="block max-w-[28ch] truncate sm:max-w-[48ch]">
                                    {renderCrumb(entry, isLast)}
                                </span>
                            </BreadcrumbItem>
                            {isLast ? null : <BreadcrumbSeparator />}
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
};

export default BlogBreadcrumb;
