import Avatar from '@/components/ui/avatar';

import { Section } from './shared';

export default function AvatarSection() {
    return (
        <Section title="Avatar" description="Sizes and fallbacks">
            <div className="flex flex-wrap items-end gap-6">
                <div className="flex flex-col items-center gap-2">
                    <Avatar alt="User" name="Jane Doe" initials />
                    <span className="text-xs text-muted-foreground">Initials</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Avatar alt="User" name="AB" initials />
                    <span className="text-xs text-muted-foreground">Fallback</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Avatar alt="Avatar" src="https://api.dicebear.com/7.x/avataaars/svg?seed=test" />
                    <span className="text-xs text-muted-foreground">Image</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Avatar alt="Small" name="S" initials size="sm" />
                    <Avatar alt="Default" name="M" initials />
                    <Avatar alt="Large" name="L" initials size="lg" />
                    <span className="text-xs text-muted-foreground">Sizes</span>
                </div>
            </div>
        </Section>
    );
}
