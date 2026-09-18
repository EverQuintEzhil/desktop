import ThemeSwitcher from '@/components/theme-switcher';
import { useAppearance, type Appearance } from '@/hooks';

const THEME_LABEL = 'Theme';

const THEME_DESCRIPTIONS: Record<Appearance, string> = {
    light: 'Always use the light theme on this device.',
    dark: 'Always use the dark theme on this device.',
    system: 'Follows the light or dark setting of your device.',
};

const AppearancePanel = () => {
    const { appearance } = useAppearance();

    return (
        <div className="appearance-panel mx-auto flex w-full max-w-4xl flex-col gap-6">
            <div className="appearance-panel-header flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight">Appearance</h2>
                <p className="text-sm text-muted-foreground">Choose how the interface looks on this device.</p>
            </div>
            <div className="appearance-panel-card flex flex-col rounded-xl bg-card shadow-none">
                <div className="appearance-panel-row flex flex-col items-start justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="appearance-panel-row-label flex flex-col">
                        <span className="text-sm font-medium">{THEME_LABEL}</span>
                        <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
                            {THEME_DESCRIPTIONS[appearance]}
                        </span>
                    </div>
                    <ThemeSwitcher />
                </div>
            </div>
        </div>
    );
};

export default AppearancePanel;
