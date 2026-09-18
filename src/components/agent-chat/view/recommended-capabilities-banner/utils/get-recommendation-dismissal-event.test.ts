import { describe, expect, it } from 'vitest';

import type { CapabilityChip } from '../types';

import { getRecommendationDismissalEvent, getRecommendationType } from './get-recommendation-dismissal-event';

const connector = (_id: string, name: string, action: CapabilityChip['action']): CapabilityChip => ({
    key: `connector:${_id}`,
    _id,
    name,
    kind: 'connector',
    action,
});

const skill = (_id: string, name: string): CapabilityChip => ({
    key: `skill:${_id}`,
    _id,
    name,
    kind: 'skill',
    action: 'enable',
});

describe('getRecommendationType', () => {
    it('names what the chip was asking the viewer to do', () => {
        expect(getRecommendationType(connector('github', 'GitHub', 'reconnect'))).toBe('reconnect_connector');
        expect(getRecommendationType(connector('notion', 'Notion', 'connect'))).toBe('connect_connector');
        expect(getRecommendationType(connector('shell', 'Shell', 'enable'))).toBe('enable_connector');
        expect(getRecommendationType(skill('skill-1', 'Brand voice'))).toBe('enable_skill');
    });
});

describe('getRecommendationDismissalEvent', () => {
    it('reports the single connector flat, for a direct breakdown', () => {
        expect(getRecommendationDismissalEvent('agent-1', [connector('github', 'GitHub', 'reconnect')])).toEqual({
            surface: 'chat_composer',
            agent_id: 'agent-1',
            recommendation_type: 'reconnect_connector',
            connector_id: 'github',
            item_count: 1,
            items: [{ recommendation_type: 'reconnect_connector', capability_id: 'github', name: 'GitHub' }],
        });
    });

    it('keeps the shared type when every dismissed item asked for the same thing', () => {
        const event = getRecommendationDismissalEvent('agent-1', [
            connector('github', 'GitHub', 'reconnect'),
            connector('notion', 'Notion', 'reconnect'),
        ]);

        expect(event.recommendation_type).toBe('reconnect_connector');
        expect(event.item_count).toBe(2);
    });

    it('reports a row of differing asks as mixed', () => {
        const event = getRecommendationDismissalEvent('agent-1', [
            connector('github', 'GitHub', 'reconnect'),
            skill('skill-1', 'Brand voice'),
        ]);

        expect(event.recommendation_type).toBe('mixed');
        expect(event.items).toEqual([
            { recommendation_type: 'reconnect_connector', capability_id: 'github', name: 'GitHub' },
            { recommendation_type: 'enable_skill', capability_id: 'skill-1', name: 'Brand voice' },
        ]);
    });

    it('leaves connector_id unset when the row was not a single connector', () => {
        expect(getRecommendationDismissalEvent('agent-1', [skill('skill-1', 'Brand voice')]).connector_id).toBeNull();
        expect(
            getRecommendationDismissalEvent('agent-1', [
                connector('github', 'GitHub', 'reconnect'),
                connector('notion', 'Notion', 'connect'),
            ]).connector_id,
        ).toBeNull();
    });
});
