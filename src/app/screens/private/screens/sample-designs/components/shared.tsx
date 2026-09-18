import React from 'react';

export function Section({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="sample-designs-section max-w-3xl">
            <h1 className="mb-1 text-2xl font-semibold text-foreground">{title}</h1>
            {description && <p className="mb-6 text-sm text-muted-foreground">{description}</p>}
            {children}
        </section>
    );
}

export function Block({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-foreground">{title}</h3>
            {children}
        </div>
    );
}
