import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import FieldEditor from './field-editor';
import { createField, type SchemaField } from './schema-field';

const renderEditor = (field: Partial<SchemaField> = {}, isSchemaLocked = false) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rendered = renderWithProviders(
        <FieldEditor
            field={createField({ name: 'companyName', ...field })}
            isSchemaLocked={isSchemaLocked}
            onChange={onChange}
            onDelete={vi.fn()}
        />,
    );

    return { ...rendered, onChange, user };
};

const expandField = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(screen.getByRole('button', { name: new RegExp(name) }));
};

const readOnlySwitch = () => screen.getByRole('switch', { name: 'Read only' });

describe('FieldEditor — read only toggle', () => {
    it('reflects the flag off the field', async () => {
        const { user } = renderEditor({ readOnly: true });

        await expandField(user, 'companyName');

        expect(readOnlySwitch()).toBeChecked();
    });

    it('is unchecked for a field that is not flagged', async () => {
        const { user } = renderEditor();

        await expandField(user, 'companyName');

        expect(readOnlySwitch()).not.toBeChecked();
    });

    it('patches readOnly to true when turned on', async () => {
        const { user, onChange } = renderEditor();

        await expandField(user, 'companyName');
        await user.click(readOnlySwitch());

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ readOnly: true }));
    });

    it('patches readOnly to false when turned off', async () => {
        const { user, onChange } = renderEditor({ readOnly: true });

        await expandField(user, 'companyName');
        await user.click(readOnlySwitch());

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ readOnly: false }));
    });

    it('explains what the flag means for the user', async () => {
        const { user } = renderEditor();

        await expandField(user, 'companyName');

        expect(screen.getByText('Users can see this field but cannot change it.')).toBeInTheDocument();
    });

    it('is disabled when the whole editor is not editable', async () => {
        const { user } = renderEditor({}, true);

        await expandField(user, 'companyName');

        expect(readOnlySwitch()).toBeDisabled();
    });
});

describe('FieldEditor — read only badge', () => {
    it('surfaces the flag in the collapsed header', () => {
        renderEditor({ readOnly: true });

        expect(screen.getByText('read only')).toBeInTheDocument();
    });

    it('shows no badge for a field that is not flagged', () => {
        renderEditor();

        expect(screen.queryByText('read only')).not.toBeInTheDocument();
    });
});

describe('FieldEditor — nesting', () => {
    it('patches only the child when a nested field is toggled', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const child = createField({ name: 'city' });

        renderWithProviders(
            <FieldEditor
                field={createField({ name: 'employer', type: 'object', properties: [child] })}
                onChange={onChange}
                onDelete={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', { name: /employer/ }));
        await user.click(screen.getByRole('button', { name: /city/ }));

        const nested = screen.getByText('Nested properties').closest('.nested-fields') as HTMLElement;

        await user.click(within(nested).getByRole('switch', { name: 'Read only' }));

        const patched = onChange.mock.calls.at(-1)?.[0] as SchemaField;

        expect(patched.readOnly).toBe(false);
        expect(patched.properties[0].readOnly).toBe(true);
    });
});
