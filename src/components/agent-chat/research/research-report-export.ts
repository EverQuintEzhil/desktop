import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

import { makeSafeDownloadFilename } from '@/utils';

import './research-report-export.scss';

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PAGE_MARGIN_PT = 32;
// The report is captured, not re-typeset, so the PDF matches what the pane shows — including
// tables, which a text-only PDF would flatten into unaligned lines.
const CAPTURE_PIXEL_RATIO = 2;
// JPEG rather than PNG: a full report captured at 2x lands around 6 MB as PNG, which is a heavy
// download for a document that is mostly text.
const CAPTURE_QUALITY = 0.92;
const PRINT_CLASS_NAME = 'research-report-print';

const PRINT_HOST_CLASS_NAME = 'research-report-print-host';

const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

export const downloadReportMarkdown = (title: string, markdown: string) => {
    saveBlob(new Blob([markdown], { type: 'text/markdown' }), makeSafeDownloadFilename(title, { extension: 'md' }));
};

const loadImageSize = (dataUrl: string): Promise<{ width: number; height: number }> =>
    new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('Could not read the captured report'));
        image.src = dataUrl;
    });

/**
 * A detached copy of the report typeset for paper. The pane node itself wears the sidebar's
 * compact prose — every heading at 14px — and sits on the theme's tinted ground, so capturing it
 * gives a screenshot rather than a document.
 */
const mountPrintClone = (node: HTMLElement): { host: HTMLElement; page: HTMLElement } => {
    const host = document.createElement('div');
    const page = document.createElement('div');
    const body = node.cloneNode(true) as HTMLElement;

    body.removeAttribute('class');
    // The clone lives in the document for the capture; duplicate ids would hijack a citation click.
    body.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    host.setAttribute('aria-hidden', 'true');
    page.className = PRINT_CLASS_NAME;
    host.className = PRINT_HOST_CLASS_NAME;
    page.appendChild(body);
    host.appendChild(page);
    document.body.appendChild(host);

    return { host, page };
};

export const downloadReportPdf = async (title: string, node: HTMLElement) => {
    const { host, page } = mountPrintClone(node);

    try {
        const dataUrl = await toJpeg(page, {
            backgroundColor: '#ffffff',
            pixelRatio: CAPTURE_PIXEL_RATIO,
            quality: CAPTURE_QUALITY,
        });
        const { width, height } = await loadImageSize(dataUrl);
        const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
        const contentWidth = A4_WIDTH_PT - PAGE_MARGIN_PT * 2;
        const contentHeight = A4_HEIGHT_PT - PAGE_MARGIN_PT * 2;
        const scaledHeight = (height / width) * contentWidth;
        const pageCount = Math.max(1, Math.ceil(scaledHeight / contentHeight));

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
            if (pageIndex > 0) pdf.addPage();

            // One tall image drawn once per page, shifted up by a page of content. What falls
            // outside the page is clipped by the page itself; the bands below hide what lands in
            // the margins.
            pdf.addImage(
                dataUrl,
                'JPEG',
                PAGE_MARGIN_PT,
                PAGE_MARGIN_PT - pageIndex * contentHeight,
                contentWidth,
                scaledHeight,
            );
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, A4_WIDTH_PT, PAGE_MARGIN_PT, 'F');
            pdf.rect(0, A4_HEIGHT_PT - PAGE_MARGIN_PT, A4_WIDTH_PT, PAGE_MARGIN_PT, 'F');
        }

        pdf.save(makeSafeDownloadFilename(title, { extension: 'pdf' }));
    } finally {
        host.remove();
    }
};
