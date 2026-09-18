import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';

import { useAppearance, type Appearance } from '@/hooks';
import { cn } from '@/lib/utils';
import '@/components/ui/switch-shared.scss';

import './theme-switcher.scss';

const OPTIONS: { value: Appearance; label: string; Icon: typeof SunIcon }[] = [
    { value: 'light', label: 'Light', Icon: SunIcon },
    { value: 'dark', label: 'Dark', Icon: MoonIcon },
    { value: 'system', label: 'System', Icon: MonitorIcon },
];

interface ThemeSwitcherProps {
    className?: string;
}

// Not built on ui/switch: Radix ToggleGroup's roving focus moves focus on arrow keys, not the selection.
const ThemeSwitcher = ({ className }: ThemeSwitcherProps) => {
    const { appearance, setAppearance } = useAppearance();
    const activeIndex = OPTIONS.findIndex((option) => option.value === appearance);

    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        let nextIndex: number;

        switch (event.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                nextIndex = (activeIndex - 1 + OPTIONS.length) % OPTIONS.length;
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                nextIndex = (activeIndex + 1) % OPTIONS.length;
                break;
            case 'Home':
                nextIndex = 0;
                break;
            case 'End':
                nextIndex = OPTIONS.length - 1;
                break;
            default:
                return;
        }

        // The avatar-menu popover has its own ArrowUp/Down/Home/End roving focus over
        // .avatar-menu-action items; without this it steals focus out of the radiogroup.
        event.preventDefault();
        event.stopPropagation();

        setAppearance(OPTIONS[nextIndex].value);

        const radios = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');

        radios[nextIndex]?.focus();
    };

    return (
        <div
            role="radiogroup"
            aria-label="Theme"
            data-active-index={activeIndex}
            onKeyDown={onKeyDown}
            className={cn(
                'theme-switcher switch switch--color-primary switch--width-xs hide-label-mobile-xs relative flex w-fit items-center rounded-full',
                className,
            )}
        >
            <div className="active-indicator" aria-hidden />
            {OPTIONS.map(({ value, label, Icon }) => {
                const isActive = appearance === value;

                return (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={`${label} theme`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => setAppearance(value)}
                        className={cn(
                            'switch-item flex cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-transparent px-2',
                            'focus-visible:ring-[1.5px] focus-visible:outline-none',
                            isActive ? 'active focus-visible:ring-white' : 'focus-visible:ring-(--color-focus-ring)',
                        )}
                    >
                        <Icon className="size-4" aria-hidden="true" />
                        <span className="hide-label-mobile text-sm">{label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default ThemeSwitcher;
