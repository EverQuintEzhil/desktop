import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { utils, write } from 'xlsx';

import SpreadsheetPreview from './spreadsheet-preview';

const csvBlob = (body: string) => new Blob([body], { type: 'text/csv' });

const workbookBlob = () => {
    const workbook = utils.book_new();

    utils.book_append_sheet(workbook, utils.aoa_to_sheet([['city'], ['Lisbon']]), 'Cities');
    utils.book_append_sheet(workbook, utils.aoa_to_sheet([['animal'], ['Otter']]), 'Animals');

    return new Blob([write(workbook, { type: 'array', bookType: 'xlsx' })]);
};

describe('SpreadsheetPreview', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders a csv as a table with the first row as header', async () => {
        render(<SpreadsheetPreview blob={csvBlob('name,age\nada,36\ngrace,41')} name="people.csv" />);

        expect(await screen.findByRole('table', { name: 'Preview of people.csv' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'name' })).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: 'ada' })).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: '41' })).toBeInTheDocument();
    });

    it('reports the parsed content as csv text', async () => {
        const onContentLoaded = vi.fn();

        render(<SpreadsheetPreview blob={csvBlob('name,age\nada,36')} onContentLoaded={onContentLoaded} />);

        await waitFor(() => expect(onContentLoaded).toHaveBeenCalledWith(expect.stringContaining('ada,36')));
    });

    it('renders only the first 500 rows and says so', async () => {
        const body = ['col', ...Array.from({ length: 700 }, (_, index) => `row-${index}`)].join('\n');

        render(<SpreadsheetPreview blob={csvBlob(body)} />);

        expect(
            await screen.findByText('Preview is limited to the first 500 rows. Download the file for the full data.'),
        ).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: 'row-498' })).toBeInTheDocument();
        expect(screen.queryByRole('cell', { name: 'row-499' })).not.toBeInTheDocument();
    });

    it('still reports truncation when the clipped window contains blank rows', async () => {
        const body = ['col', 'row-0', '', ...Array.from({ length: 700 }, (_, index) => `row-${index + 1}`)].join('\n');

        render(<SpreadsheetPreview blob={csvBlob(body)} />);

        expect(
            await screen.findByText('Preview is limited to the first 500 rows. Download the file for the full data.'),
        ).toBeInTheDocument();
    });

    it('reports an empty text for a clipped sheet so Copy cannot copy a fragment', async () => {
        const body = ['col', ...Array.from({ length: 700 }, (_, index) => `row-${index}`)].join('\n');
        const onContentLoaded = vi.fn();

        render(<SpreadsheetPreview blob={csvBlob(body)} onContentLoaded={onContentLoaded} />);

        await waitFor(() => expect(onContentLoaded).toHaveBeenCalledWith(''));
        expect(onContentLoaded).not.toHaveBeenCalledWith(expect.stringContaining('row-0'));
    });

    it('reports the newly visible sheet on tab switch so Copy follows the tabs', async () => {
        const user = userEvent.setup();
        const onContentLoaded = vi.fn();

        render(<SpreadsheetPreview blob={workbookBlob()} onContentLoaded={onContentLoaded} />);

        await waitFor(() => expect(onContentLoaded).toHaveBeenCalledWith(expect.stringContaining('Lisbon')));

        await user.click(screen.getByRole('button', { name: 'Animals' }));

        await waitFor(() => expect(onContentLoaded).toHaveBeenCalledWith(expect.stringContaining('Otter')));
    });

    it('switches between sheets of a workbook', async () => {
        const user = userEvent.setup();

        render(<SpreadsheetPreview blob={workbookBlob()} name="book.xlsx" />);

        expect(await screen.findByRole('cell', { name: 'Lisbon' })).toBeInTheDocument();
        expect(screen.queryByRole('cell', { name: 'Otter' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Animals' }));

        expect(screen.getByRole('cell', { name: 'Otter' })).toBeInTheDocument();
        expect(screen.queryByRole('cell', { name: 'Lisbon' })).not.toBeInTheDocument();
    });

    it('shows the shared error copy when the blob is not a readable workbook', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        // A zip local-file-header magic with a truncated body makes SheetJS throw instead of
        // falling back to its plain-text csv parser.
        render(<SpreadsheetPreview blob={new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])])} />);

        expect(
            await screen.findByText('Unable to load this file. Please try downloading it instead.'),
        ).toBeInTheDocument();
    });
});
