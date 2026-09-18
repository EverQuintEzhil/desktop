import type { ReactNode } from 'react';

export interface MessageFilesSectionProps {
    title: string;
    children: ReactNode;
}

export const MessageFilesSection = ({ title, children }: MessageFilesSectionProps) => (
    <div className="each-row flex flex-col gap-1 px-2">
        <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{title}</span>
        </div>
        <div className="image-list flex flex-wrap items-center gap-2">{children}</div>
    </div>
);
