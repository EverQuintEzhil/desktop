import Markdown from '@/components/markdown';
import { sanitizeHtmlViewer } from '@/lib/sanitize-html';

import './render-response-content.scss';

const stringifyDisplayData = (displayData: unknown): string => {
    if (typeof displayData === 'string') {
        return displayData;
    }

    return JSON.stringify(displayData, null, 2);
};

export default function renderResponseContent(uiType: string, displayData: unknown) {
    switch (uiType) {
        case 'jsonviewer': {
            let parsedDisplayData = displayData;

            if (typeof parsedDisplayData === 'string') {
                try {
                    parsedDisplayData = JSON.parse(parsedDisplayData);
                } catch (e) {
                    console.error('Failed to parse JSON:', e);
                }
            }
            const str = stringifyDisplayData(parsedDisplayData);

            return (
                <div className="viewer-container jsonviewer">
                    <pre className="json-container">{str}</pre>
                </div>
            );
        }
        case 'markdownviewer': {
            const markdown = stringifyDisplayData(displayData);

            return (
                <div className="viewer-container markdownviewer">
                    <div className="markdown-viewer">
                        <Markdown>{markdown}</Markdown>
                    </div>
                </div>
            );
        }
        case 'htmlviewer': {
            const html = stringifyDisplayData(displayData);

            return (
                <div
                    className="viewer-container htmlviewer"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtmlViewer(html) }}
                />
            );
        }
        case 'plaintextviewer': {
            const text = stringifyDisplayData(displayData);

            return (
                <div className="viewer-container plaintextviewer">
                    <div className="plain-text-viewer">{text}</div>
                </div>
            );
        }
        default: {
            return null;
        }
    }
}
