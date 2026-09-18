import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toJpeg = vi.fn();
const addImage = vi.fn();
const addPage = vi.fn();
const setFillColor = vi.fn();
const rect = vi.fn();
const save = vi.fn();

vi.mock('html-to-image', () => ({ toJpeg: (...args: unknown[]) => toJpeg(...args) }));
vi.mock('jspdf', () => ({
    jsPDF: class {
        addImage = addImage;
        addPage = addPage;
        setFillColor = setFillColor;
        rect = rect;
        save = save;
    },
}));

import { downloadReportPdf } from './research-report-export';

// A 720 x 3000 capture: tall enough to need more than one A4 page.
class StubImage {
    naturalWidth = 720;
    naturalHeight = 3000;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(_value: string) {
        queueMicrotask(() => this.onload?.());
    }
}

const mountPaneBody = () => {
    const node = document.createElement('div');

    node.className = '[&_.prose_:is(h1,h2,h3)]:text-sm! sidebar-card-prose';
    node.innerHTML = '<div class="markdown prose"><h1>Findings</h1><p>Body <a href="https://x">x</a></p></div>';
    document.body.appendChild(node);

    return node;
};

describe('downloadReportPdf', () => {
    const originalImage = globalThis.Image;

    beforeEach(() => {
        vi.clearAllMocks();
        toJpeg.mockResolvedValue('data:image/jpeg;base64,AAAA');
        globalThis.Image = StubImage as unknown as typeof Image;
    });

    afterEach(() => {
        globalThis.Image = originalImage;
        document.body.innerHTML = '';
    });

    it('captures a print-styled clone on a white page, never the pane node itself', async () => {
        const node = mountPaneBody();

        await downloadReportPdf('Findings', node);

        const [captured, options] = toJpeg.mock.calls[0] as [HTMLElement, { backgroundColor: string }];

        expect(captured).not.toBe(node);
        expect(captured.className).toBe('research-report-print');
        expect(options.backgroundColor).toBe('#ffffff');
        // The clone carries the report but has shed the sidebar's compact-prose classes.
        expect(captured.querySelector('h1')?.textContent).toBe('Findings');
        expect(captured.querySelector('.sidebar-card-prose')).toBeNull();
        // The pane's own node is untouched.
        expect(node.className).toContain('sidebar-card-prose');
    });

    it('paints the margin bands white rather than the theme ground', async () => {
        const node = mountPaneBody();

        node.style.backgroundColor = 'rgb(240, 243, 252)';
        await downloadReportPdf('Findings', node);

        expect(setFillColor).toHaveBeenCalled();
        for (const call of setFillColor.mock.calls) expect(call).toEqual([255, 255, 255]);
    });

    it('removes the clone from the document once the capture is done', async () => {
        await downloadReportPdf('Findings', mountPaneBody());

        expect(document.querySelector('.research-report-print')).toBeNull();
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('removes the clone even when the capture fails', async () => {
        toJpeg.mockRejectedValueOnce(new Error('boom'));

        await expect(downloadReportPdf('Findings', mountPaneBody())).rejects.toThrow('boom');
        expect(document.querySelector('.research-report-print')).toBeNull();
    });

    it('splits a tall capture across pages', async () => {
        await downloadReportPdf('Findings', mountPaneBody());

        expect(addPage.mock.calls.length).toBeGreaterThan(0);
        expect(addImage).toHaveBeenCalledTimes(addPage.mock.calls.length + 1);
    });
});
