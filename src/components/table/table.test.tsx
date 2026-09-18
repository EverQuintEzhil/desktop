import type { ColumnDef } from '@tanstack/react-table';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MIN_COLUMN_WIDTH } from '@/hooks/table-layout';
import type { TableLayout } from '@/hooks/table-layout/types';
import { installElementFromPointShim, installPointerCaptureShims, installWebAnimationsShims } from '@/test/dom-shims';
import { apiUrl, envelope, httpError, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import Table from './table';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

installWebAnimationsShims();
// dnd-kit's pointer sensor calls setPointerCapture on drag start and cancels if it throws.
installPointerCaptureShims();
installElementFromPointShim();

const HANDLE_X = 20;
const HEADER_Y = 24;

const press = (handle: HTMLElement, clientX: number) =>
    fireEvent.pointerDown(handle, {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        isPrimary: true,
        clientX,
        clientY: HEADER_Y,
    });

const movePointer = (clientX: number) =>
    fireEvent.pointerMove(document, {
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        clientX,
        clientY: HEADER_Y,
    });

const release = (clientX: number) =>
    fireEvent.pointerUp(document, {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        isPrimary: true,
        clientX,
        clientY: HEADER_Y,
    });

/** dnd-kit schedules its own work off the event, so give it a turn before asserting. */
const settle = () =>
    act(
        () =>
            new Promise((resolve) => {
                setTimeout(resolve, 50);
            }),
    );

const isDragActive = () => document.querySelector('[data-dnd-dragging]') !== null;

interface Row {
    name: string;
    email: string;
    role: string;
}

const columns: ColumnDef<Row, unknown>[] = [
    { id: 'name', header: 'Name', accessorKey: 'name' },
    { id: 'email', header: 'Email', accessorKey: 'email' },
    { id: 'role', header: 'Role', accessorKey: 'role' },
    { id: 'actions', header: 'Actions', cell: () => 'edit' },
];

const data: Row[] = [{ name: 'Ada', email: 'ada@example.com', role: 'admin' }];

const TABLE_KEY = 'admin:test-table';
const LAYOUT_PATH = '/users/me/tablepreferences/*';

let stored: TableLayout | null = null;
let calls: string[] = [];

/** Stands in for `user_table_preferences`, including the API's merge-on-PUT semantics. */
const stubLayoutApi = () => {
    server.use(
        http.get(apiUrl(LAYOUT_PATH), () => {
            calls.push('get');

            return envelope(stored ? { tableKey: TABLE_KEY, layout: stored } : null);
        }),
        http.put(apiUrl(LAYOUT_PATH), async ({ request }) => {
            const body = (await request.json()) as TableLayout;

            calls.push('put');

            const next: TableLayout = {};
            const order = body.order ?? stored?.order;
            const widths = body.widths === undefined ? stored?.widths : { ...(stored?.widths ?? {}), ...body.widths };

            if (order) next.order = order;
            if (widths && Object.keys(widths).length > 0) next.widths = widths;

            stored = next;

            return envelope({ tableKey: TABLE_KEY, layout: stored });
        }),
        http.delete(apiUrl(LAYOUT_PATH), () => {
            calls.push('delete');
            stored = null;

            return envelope(null);
        }),
    );
};

const getHeaderLabels = () => screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim());

/** jsdom has no layout engine, so assert the width the component actually set. */
const getHeaderWidth = (name: RegExp) => parseFloat(screen.getByRole('columnheader', { name }).style.width);

const COLUMN_WIDTH = 150;

const makeRect = (left: number, top: number, width: number, height: number) =>
    ({
        x: left,
        y: top,
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        toJSON: () => ({}),
    }) as DOMRect;

const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

const restoreCellRects = () => {
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        writable: true,
        value: originalGetBoundingClientRect,
    });
};

/**
 * jsdom reports every element as a zero-sized rect, so dnd-kit can't resolve a drop target. Each
 * table cell gets a rect derived from its column index to make the drag measurable.
 *
 * The ancestors need a rect too: dnd-kit clips a droppable to the visible area of every ancestor
 * whose overflow is not `visible`, and jsdom leaves the `overflow` shorthand empty on every element,
 * so an unstubbed wrapper collapses the column it contains to nothing.
 */
const stubCellRects = () => {
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        writable: true,
        value: () => makeRect(0, 0, 1024, 768),
    });

    document.querySelectorAll('th, td').forEach((cell) => {
        const top = cell.tagName === 'TH' ? 0 : 48;

        // Read `cellIndex` lazily: dnd-kit physically reorders the cells as the drag
        // progresses, so a position captured now would go stale after the first move.
        cell.getBoundingClientRect = () =>
            makeRect((cell as HTMLTableCellElement).cellIndex * COLUMN_WIDTH, top, COLUMN_WIDTH, 48);
    });
};

const renderTable = (columnLayoutKey?: string, showHeader = false) =>
    renderWithProviders(
        <Table
            data={data}
            columns={columns}
            firstLoading={false}
            showHeader={showHeader}
            columnLayoutKey={columnLayoutKey}
        />,
    );

describe('Table column layout', () => {
    beforeEach(() => {
        stored = null;
        calls = [];
        stubLayoutApi();
    });

    afterEach(restoreCellRects);

    it('does not read or offer layout persistence without a columnLayoutKey', async () => {
        renderTable();

        expect(getHeaderLabels()).toEqual(['Name', 'Email', 'Role', 'Actions']);
        expect(screen.queryByLabelText('Reorder Name column')).not.toBeInTheDocument();
        // dnd-kit mounts a live region; its absence proves no DragDropProvider was mounted.
        expect(document.querySelector('[role="status"]')).toBeNull();
        expect(calls).toEqual([]);
    });

    it('mounts drag-and-drop and reads the stored layout for tables that opt in', async () => {
        renderTable(TABLE_KEY);

        expect(await screen.findByLabelText('Reorder Name column')).toBeInTheDocument();
        // dnd-kit appends its live region once a draggable registers, one effect after mount.
        await waitFor(() => expect(document.querySelector('[role="status"]')).not.toBeNull());
        await waitFor(() => expect(calls).toContain('get'));
    });

    it('renders the stored column order and a drag handle per movable column', async () => {
        stored = { order: ['role', 'name', 'email'] };

        renderTable(TABLE_KEY);

        await waitFor(() => {
            expect(getHeaderLabels()).toEqual(['Role', 'Name', 'Email', 'Actions']);
        });

        expect(screen.getByLabelText('Reorder Role column')).toBeInTheDocument();
        expect(screen.queryByLabelText('Reorder Actions column')).not.toBeInTheDocument();
    });

    it('applies stored widths and ignores entries for columns that no longer render', async () => {
        stored = { widths: { email: 320, removedColumn: 200 } };

        renderTable(TABLE_KEY);

        await waitFor(() => expect(getHeaderWidth(/Email/)).toBe(320));

        // Unknown ids are ignored on read but must NOT be deleted: the same table can render a
        // narrower column set (permissions, filters) and merely visiting it must not lose data.
        expect(stored).toEqual({ widths: { email: 320, removedColumn: 200 } });
        expect(calls).toEqual(['get']);
    });

    it('ignores stored widths too narrow to be usable', async () => {
        stored = { widths: { email: 0, role: 12 } };

        renderTable(TABLE_KEY);

        await waitFor(() => expect(screen.getByLabelText('Reorder Name column')).toBeInTheDocument());

        expect(getHeaderWidth(/Email/)).not.toBe(0);
        expect(getHeaderWidth(/Role/)).not.toBe(12);
    });

    it('keeps every drag handle available through a resize gesture', async () => {
        renderTable(TABLE_KEY);

        await screen.findByLabelText('Reorder Name column');

        const countHandles = () => document.querySelectorAll('.table-drag-handle').length;
        const before = countHandles();
        const resizer = document.querySelector('.resizer') as HTMLElement;

        fireEvent.mouseDown(resizer, { clientX: 0 });
        fireEvent.mouseMove(document, { clientX: 60 });

        // Resizing must not hide the reorder affordance -- they are separate elements.
        expect(countHandles()).toBe(before);

        fireEvent.mouseUp(document, { clientX: 60 });

        await waitFor(() => expect(stored?.widths?.name).toBeGreaterThan(MIN_COLUMN_WIDTH));
        expect(countHandles()).toBe(before);
    });

    it('persists a width after a resize gesture, and only once the gesture ends', async () => {
        renderTable(TABLE_KEY);

        await screen.findByLabelText('Reorder Name column');

        const resizer = document.querySelector('.resizer') as HTMLElement;

        fireEvent.mouseDown(resizer, { clientX: 0 });
        fireEvent.mouseMove(document, { clientX: 60 });

        expect(calls).not.toContain('put');

        fireEvent.mouseUp(document, { clientX: 60 });

        await waitFor(() => expect(stored?.widths?.name).toBeGreaterThan(MIN_COLUMN_WIDTH));
        expect(calls.filter((call) => call === 'put')).toHaveLength(1);
    });

    it('replaces the row when a width is dropped, since the API merges widths', async () => {
        stored = { order: ['name', 'email', 'role'], widths: { name: 300 } };

        renderTable(TABLE_KEY);

        await waitFor(() => expect(getHeaderWidth(/Name/)).toBe(300));

        fireEvent.doubleClick(document.querySelector('.resizer') as HTMLElement);

        await waitFor(() => expect(stored?.widths).toBeUndefined());
        // A plain PUT would have merged the old width straight back in.
        expect(calls).toEqual(['get', 'delete', 'put']);
        expect(stored?.order).toEqual(['name', 'email', 'role']);
    });

    it('persists a keyboard-driven reorder', async () => {
        const user = userEvent.setup();

        renderTable(TABLE_KEY);

        const handle = await screen.findByLabelText('Reorder Name column');

        stubCellRects();
        handle.focus();
        await user.keyboard('{ }');
        await user.keyboard('{ArrowRight}');
        await user.keyboard('{ }');

        await waitFor(() => expect(stored?.order).toEqual(['email', 'name', 'role']));
        expect(getHeaderLabels()).toEqual(['Email', 'Name', 'Role', 'Actions']);
    });

    it('stores only the movable columns, leaving the locked one where the definitions put it', async () => {
        const user = userEvent.setup();

        renderTable(TABLE_KEY);

        const handle = await screen.findByLabelText('Reorder Role column');

        stubCellRects();
        handle.focus();
        await user.keyboard('{ }');
        await user.keyboard('{ArrowRight}');
        await user.keyboard('{ }');

        // 'actions' is locked, so 'role' has nowhere further right to go and nothing is stored.
        await waitFor(() => expect(getHeaderLabels()).toEqual(['Name', 'Email', 'Role', 'Actions']));
        expect(calls).not.toContain('put');
    });

    it('walks a column across every movable slot', async () => {
        const user = userEvent.setup();

        renderTable(TABLE_KEY);

        const handle = await screen.findByLabelText('Reorder Name column');

        stubCellRects();
        handle.focus();
        await user.keyboard('{ }');
        await user.keyboard('{ArrowRight}');
        await user.keyboard('{ArrowRight}');
        await user.keyboard('{ }');

        await waitFor(() => expect(stored?.order).toEqual(['email', 'role', 'name']));
        expect(getHeaderLabels()).toEqual(['Email', 'Role', 'Name', 'Actions']);
    });

    it('does not start a drag when the handle is merely clicked', async () => {
        renderTable(TABLE_KEY);

        const handle = await screen.findByLabelText('Reorder Name column');

        stubCellRects();
        press(handle, HANDLE_X);
        await settle();

        // dnd-kit marks the dragged element and clones a placeholder into the row the instant a
        // drag starts, and puts `position: fixed` on it -- which is what shifted the cell content.
        expect(isDragActive()).toBe(false);
        expect(document.querySelector('[data-dnd-placeholder]')).toBeNull();
        expect(screen.getAllByRole('columnheader')).toHaveLength(4);

        release(HANDLE_X);
        await settle();

        expect(getHeaderLabels()).toEqual(['Name', 'Email', 'Role', 'Actions']);
        expect(calls).not.toContain('put');
        expect(stored).toBeNull();
    });

    /**
     * Only asserts that the gesture activates. Carrying a pointer drag through to a reorder is not
     * honestly testable here: dnd-kit clones a placeholder cell into the row on drag start, which
     * invalidates any index-derived rect stub. The keyboard tests above cover the reorder maths.
     */
    it('activates the drag once the pointer travels past the activation distance', async () => {
        renderTable(TABLE_KEY);

        const handle = await screen.findByLabelText('Reorder Name column');

        stubCellRects();
        press(handle, HANDLE_X);
        await settle();

        expect(isDragActive()).toBe(false);

        movePointer(HANDLE_X + 8);
        await settle();

        expect(isDragActive()).toBe(true);

        release(HANDLE_X + 8);
        await settle();
    });

    it('discards a reorder cancelled with Escape', async () => {
        const user = userEvent.setup();

        renderTable(TABLE_KEY);

        const handle = await screen.findByLabelText('Reorder Name column');

        stubCellRects();
        handle.focus();
        await user.keyboard('{ }');
        await user.keyboard('{ArrowRight}');
        await user.keyboard('{Escape}');

        await waitFor(() => expect(getHeaderLabels()).toEqual(['Name', 'Email', 'Role', 'Actions']));
        expect(stored).toBeNull();
        expect(calls).not.toContain('put');
    });

    it('keeps the sort trigger working next to the drag handle', async () => {
        const user = userEvent.setup();
        const onSortingChange = vi.fn();

        renderWithProviders(
            <Table
                data={data}
                columns={columns}
                firstLoading={false}
                showHeader={false}
                columnLayoutKey={TABLE_KEY}
                onSortingChange={onSortingChange}
            />,
        );

        await user.click(await screen.findByRole('button', { name: 'Name' }));

        expect(onSortingChange).toHaveBeenCalledWith([{ id: 'name', desc: false }]);
        expect(calls).not.toContain('put');
    });

    it('clears the stored layout from the column header context menu', async () => {
        const user = userEvent.setup();

        stored = { order: ['role', 'name', 'email'], widths: { email: 320 } };

        renderTable(TABLE_KEY);

        await waitFor(() => expect(getHeaderLabels()).toEqual(['Role', 'Name', 'Email', 'Actions']));

        await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('columnheader', { name: /Role/ }) });
        await user.click(await screen.findByRole('menuitem', { name: 'Reset column layout' }));

        await waitFor(() => expect(stored).toBeNull());
        expect(getHeaderLabels()).toEqual(['Name', 'Email', 'Role', 'Actions']);
    });

    it('offers the reset item only once a layout is stored', async () => {
        const user = userEvent.setup();

        renderTable(TABLE_KEY);

        const header = await screen.findByRole('columnheader', { name: /Name/ });

        await user.pointer({ keys: '[MouseRight]', target: header });

        expect(screen.queryByRole('menuitem', { name: 'Reset column layout' })).not.toBeInTheDocument();
    });

    it('rolls back the layout and warns when the save fails', async () => {
        stored = { widths: { name: 300 } };

        renderTable(TABLE_KEY);

        await waitFor(() => expect(getHeaderWidth(/Name/)).toBe(300));

        server.use(http.put(apiUrl(LAYOUT_PATH), () => httpError(500)));

        const resizer = document.querySelector('.resizer') as HTMLElement;

        fireEvent.mouseDown(resizer, { clientX: 0 });
        fireEvent.mouseMove(document, { clientX: 60 });
        fireEvent.mouseUp(document, { clientX: 60 });

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('column layout')));
        // The optimistic width is rolled back to what the server still holds.
        await waitFor(() => expect(getHeaderWidth(/Name/)).toBe(300));
        expect(stored).toEqual({ widths: { name: 300 } });
    });
});
