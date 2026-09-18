import type { ReactNode } from 'react';

export interface SectionHeadingProps {
    title: string;
    subtitle: string;
    technical?: string;
    trailing?: ReactNode;
}

// Section header shared by the three config sections.
const SectionHeading = ({ title, subtitle, technical, trailing }: SectionHeadingProps) => (
    <div className="section-heading flex flex-wrap items-center gap-3.5 py-8">
        <div className="flex min-w-[240px] flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-baseline gap-2.5">
                <h2 className="m-0 text-xl font-semibold">{title}</h2>
                {technical ? <span className="text-xs text-text-secondary">{technical}</span> : null}
            </div>
            <span className="text-[13px] text-text-secondary">{subtitle}</span>
        </div>
        {trailing}
    </div>
);

export default SectionHeading;
