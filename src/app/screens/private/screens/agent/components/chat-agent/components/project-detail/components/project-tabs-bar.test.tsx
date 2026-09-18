import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ProjectTabsBar from './project-tabs-bar';

const ITEM_WIDTH_PX = 100;
const ITEM_PITCH_PX = 120;

const layoutProps = ['clientWidth', 'offsetWidth', 'offsetLeft'] as const;

// jsdom reports every box as 0×0, so the priority+ measurement has to be fed widths: the nav
// container gets `navWidth`, and each ghost label is laid out on a fixed pitch.
const stubLayout = (navWidth: number) => {
    const saved = layoutProps.map(
        (prop) => [prop, Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop)] as const,
    );

    const define = (prop: string, get: (el: HTMLElement) => number) =>
        Object.defineProperty(HTMLElement.prototype, prop, {
            configurable: true,
            get() {
                return get(this as HTMLElement);
            },
        });

    define('clientWidth', (el) => (el.classList.contains('project-tabs-bar-nav') ? navWidth : 0));
    define('offsetWidth', () => ITEM_WIDTH_PX);
    define('offsetLeft', (el) => {
        const siblings = Array.from(el.parentElement?.children ?? []);

        return Math.max(siblings.indexOf(el), 0) * ITEM_PITCH_PX;
    });

    return () => {
        for (const [prop, descriptor] of saved) {
            if (descriptor) {
                Object.defineProperty(HTMLElement.prototype, prop, descriptor);
            } else {
                delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop];
            }
        }
    };
};

const renderBar = (onTabChange = vi.fn()) => {
    render(<ProjectTabsBar barRef={createRef<HTMLDivElement>()} activeTab="chats" onTabChange={onTabChange} />);

    return onTabChange;
};

describe('ProjectTabsBar', () => {
    let restoreLayout: (() => void) | undefined;

    afterEach(() => {
        restoreLayout?.();
        restoreLayout = undefined;
    });

    it('renders every tab inline when they fit', () => {
        restoreLayout = stubLayout(2000);

        renderBar();

        expect(screen.getAllByRole('tab')).toHaveLength(5);
        expect(screen.queryByRole('button', { name: /More/ })).not.toBeInTheDocument();
    });

    it('selects an inline tab', async () => {
        restoreLayout = stubLayout(2000);

        const onTabChange = renderBar();

        await userEvent.click(screen.getByRole('tab', { name: 'Files' }));

        expect(onTabChange).toHaveBeenCalledWith('files');
    });

    it('collapses the tabs that do not fit into a More menu instead of overflowing', () => {
        restoreLayout = stubLayout(340);

        renderBar();

        expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Your chats', 'Shared with you']);
        expect(screen.getByRole('button', { name: /More/ })).toBeInTheDocument();
    });

    it('selects a collapsed tab from the More menu', async () => {
        restoreLayout = stubLayout(340);

        const onTabChange = renderBar();

        await userEvent.click(screen.getByRole('button', { name: /More/ }));
        await userEvent.click(await screen.findByRole('menuitem', { name: 'Activity' }));

        expect(onTabChange).toHaveBeenCalledWith('activity');
    });
});
