import { useEffect, useRef, useState } from 'react';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface SpreadsheetSheet {
    name: string;
    rows: string[][];
    isTruncated: boolean;
    csv: string;
}

interface SpreadsheetPreviewProps {
    blob: Blob;
    name?: string;
    onContentLoaded?: (text: string) => void;
}

const MAX_RENDERED_ROWS = 500;

const SpreadsheetPreview = ({ blob, name, onContentLoaded }: SpreadsheetPreviewProps) => {
    const [sheets, setSheets] = useState<SpreadsheetSheet[]>([]);
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);
    const [isParsing, setIsParsing] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const onContentLoadedRef = useRef(onContentLoaded);

    useEffect(() => {
        onContentLoadedRef.current = onContentLoaded;
    }, [onContentLoaded]);

    // Re-report on tab switch so the dialog's Copy button copies the sheet the user is looking at.
    useEffect(() => {
        const activeCsv = sheets[activeSheetIndex]?.csv;

        if (activeCsv !== undefined) onContentLoadedRef.current?.(activeCsv);
    }, [sheets, activeSheetIndex]);

    useEffect(() => {
        const controller = new AbortController();

        setIsParsing(true);
        setError(null);
        setSheets([]);
        setActiveSheetIndex(0);

        const parse = async () => {
            try {
                // SheetJS is ~1MB minified and only needed once a spreadsheet is actually opened.
                const [{ read, utils }, buffer] = await Promise.all([import('xlsx'), blob.arrayBuffer()]);

                if (controller.signal.aborted) return;

                // `sheetRows` bounds the parse itself: without it SheetJS materialises every row of
                // every sheet on the main thread, and the byte-size gate upstream only sees the
                // compressed file. One extra row tells truncation apart from an exact-cap sheet.
                const workbook = read(buffer, { dense: true, sheetRows: MAX_RENDERED_ROWS + 1 });
                const parsedSheets = workbook.SheetNames.map((sheetName) => {
                    const worksheet = workbook.Sheets[sheetName];
                    // blankrows must stay on here: filtering empties before the length check would
                    // undercount the clipped window and hide the truncation note.
                    const rawRows = utils.sheet_to_json<string[]>(worksheet, {
                        header: 1,
                        defval: '',
                        raw: false,
                        blankrows: true,
                    });
                    const isTruncated = rawRows.length > MAX_RENDERED_ROWS;
                    const renderedRows = rawRows
                        .filter((row) => row.some((cell) => cell !== ''))
                        .slice(0, MAX_RENDERED_ROWS);

                    return {
                        name: sheetName,
                        rows: renderedRows.map((row) => row.map(String)),
                        isTruncated,
                        // Empty for a clipped sheet: the parse never saw the full file, and a Copy
                        // button that silently copies a fragment is worse than no Copy button.
                        csv: isTruncated ? '' : utils.sheet_to_csv(worksheet),
                    };
                });

                setSheets(parsedSheets);
            } catch (err) {
                if (controller.signal.aborted) return;
                console.error('Error parsing spreadsheet preview:', err);
                setError('Unable to load this file. Please try downloading it instead.');
            } finally {
                if (!controller.signal.aborted) setIsParsing(false);
            }
        };

        void parse();

        return () => {
            controller.abort();
        };
    }, [blob]);

    if (isParsing) {
        return (
            <div className="spreadsheet-preview flex h-full w-full items-center justify-center text-muted-foreground">
                <Spinner className="size-6" />
            </div>
        );
    }

    if (error || sheets.length === 0) {
        return (
            <div className="spreadsheet-preview flex h-full w-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                {error ?? 'This spreadsheet has no sheets to preview.'}
            </div>
        );
    }

    const activeSheet = sheets[activeSheetIndex] ?? sheets[0];
    const [headerRow, ...bodyRows] = activeSheet.rows;

    const renderSheetTabs = () => {
        if (sheets.length < 2) return null;

        return (
            <div className="spreadsheet-preview-tabs scrollbar-controller scrollbar-horizontal flex shrink-0 items-center gap-1 pb-2">
                {sheets.map((sheet, index) => (
                    <button
                        key={sheet.name}
                        type="button"
                        className={cn(
                            'rounded-md px-2.5 py-1 text-xs whitespace-nowrap',
                            index === activeSheetIndex
                                ? 'bg-muted font-medium text-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                        onClick={() => setActiveSheetIndex(index)}
                    >
                        {sheet.name}
                    </button>
                ))}
            </div>
        );
    };

    const renderTruncationNote = () => {
        if (!activeSheet.isTruncated) return null;

        return (
            <p className="spreadsheet-preview-note shrink-0 pt-2 text-xs text-muted-foreground">
                Preview is limited to the first {MAX_RENDERED_ROWS} rows. Download the file for the full data.
            </p>
        );
    };

    return (
        <div className="spreadsheet-preview flex h-full w-full flex-col rounded-lg bg-background p-2 text-foreground">
            {renderSheetTabs()}
            <div className="spreadsheet-preview-table scrollbar-controller scrollbar-vertical scrollbar-horizontal min-h-0 flex-1 rounded-md border border-border">
                <table
                    className="w-full border-collapse text-sm"
                    aria-label={name ? `Preview of ${name}` : 'Spreadsheet preview'}
                >
                    <thead className="sticky top-0 bg-card">
                        <tr>
                            {(headerRow ?? []).map((cell, cellIndex) => (
                                <th
                                    key={cellIndex}
                                    scope="col"
                                    className="border-b border-border px-3 py-2 text-left font-medium whitespace-nowrap"
                                >
                                    {cell}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {bodyRows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="even:bg-muted/40">
                                {row.map((cell, cellIndex) => (
                                    <td
                                        key={cellIndex}
                                        className="border-b border-border px-3 py-1.5 whitespace-nowrap"
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {renderTruncationNote()}
        </div>
    );
};

export default SpreadsheetPreview;
