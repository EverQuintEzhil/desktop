import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { useUpdateSkillMutation } from '@/lib/api/common/skills';
import type { SkillType } from '@/types/admin';

import { useSkillInlineFields } from './use-skill-inline-fields';

type UpdateSkillMutation = ReturnType<typeof useUpdateSkillMutation>;

const idleMutation = { isPending: false } as UpdateSkillMutation;

const makeSkill = (overrides: Partial<SkillType> = {}): SkillType =>
    ({
        _id: 'skill-1',
        name: 'Summariser',
        description: 'Summarises a document.',
        ...overrides,
    }) as SkillType;

const renderFields = (skill: SkillType | undefined) =>
    renderHook(
        ({ skill: currentSkill }: { skill: SkillType | undefined }) =>
            useSkillInlineFields({ skill: currentSkill, isOwner: true, updateSkillMutation: idleMutation }),
        { initialProps: { skill } },
    );

describe('useSkillInlineFields', () => {
    it('keeps a mid-edit description draft when the parent refetch returns an identical skill', () => {
        const { result, rerender } = renderFields(makeSkill());

        act(() => {
            result.current.startDescEditing();
            result.current.setDescDraft('Half-typed replacement');
        });

        expect(result.current.isDescEditing).toBe(true);

        // Saving the name invalidates the `['skills']` prefix, so the detail query refetches and
        // hands back a structurally identical skill with a fresh object identity.
        rerender({ skill: makeSkill() });

        expect(result.current.isDescEditing).toBe(true);
        expect(result.current.descDraft).toBe('Half-typed replacement');
    });

    it('keeps a mid-edit name draft across a refetch that changed nothing', () => {
        const { result, rerender } = renderFields(makeSkill());

        act(() => {
            result.current.setNameDraft('Summarise');
        });

        rerender({ skill: makeSkill() });

        expect(result.current.nameDraft).toBe('Summarise');
    });

    it('rehydrates the drafts when the server really did change the skill', () => {
        const { result, rerender } = renderFields(makeSkill());

        act(() => {
            result.current.setNameDraft('Local edit');
            result.current.setDescDraft('Local description');
            result.current.startDescEditing();
        });

        rerender({ skill: makeSkill({ name: 'Renamed by someone else' }) });

        expect(result.current.nameDraft).toBe('Renamed by someone else');
        expect(result.current.descDraft).toBe('Summarises a document.');
        expect(result.current.isDescEditing).toBe(false);
    });

    it('rehydrates when the description changes on the server', () => {
        const { result, rerender } = renderFields(makeSkill());

        act(() => {
            result.current.setDescDraft('Local description');
        });

        rerender({ skill: makeSkill({ description: 'Server description' }) });

        expect(result.current.descDraft).toBe('Server description');
    });

    it('rehydrates when a different skill happens to carry the same name and description', () => {
        const { result, rerender } = renderFields(makeSkill());

        act(() => {
            result.current.setNameDraft('Local edit');
            result.current.startDescEditing();
        });

        rerender({ skill: makeSkill({ _id: 'skill-2' }) });

        expect(result.current.nameDraft).toBe('Summariser');
        expect(result.current.isDescEditing).toBe(false);
    });

    it('hydrates once the skill arrives, and holds the drafts if it goes away again', () => {
        const { result, rerender } = renderFields(undefined);

        expect(result.current.nameDraft).toBe('');

        rerender({ skill: makeSkill() });

        expect(result.current.nameDraft).toBe('Summariser');

        rerender({ skill: undefined });

        expect(result.current.nameDraft).toBe('Summariser');
    });
});
