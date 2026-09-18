import type { RefObject } from 'react';

import { CARD_PROSE_CLASS_NAME } from '@/components/markdown';
import Markdown from '@/components/markdown/markdown';

interface Props {
    markdown: string;
    bodyRef: RefObject<HTMLDivElement | null>;
}

/**
 * The finished report, read in the side pane rather than in the transcript — the shape Gemini
 * (Canvas) and Claude (a side-panel document) both use. It renders the same markdown the
 * transcript does, so the two can never disagree about what the answer says.
 *
 * Its actions live in the pane header, not here: the pane has one header, and the transcript's
 * own two cards are what switch between the trace and the report.
 */
const ResearchReportLevel = ({ markdown, bodyRef }: Props) => (
    <div ref={bodyRef} className={CARD_PROSE_CLASS_NAME}>
        <Markdown>{markdown}</Markdown>
    </div>
);

export default ResearchReportLevel;
