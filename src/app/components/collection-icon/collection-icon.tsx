import {
    BellIcon,
    BookOpenIcon,
    BotIcon,
    BriefcaseIcon,
    CodeXmlIcon,
    CompassIcon,
    DatabaseIcon,
    FileTextIcon,
    FolderIcon,
    GlobeIcon,
    GraduationCapIcon,
    LayersIcon,
    LifeBuoyIcon,
    LightbulbIcon,
    LockIcon,
    MessageSquareIcon,
    PaletteIcon,
    PuzzleIcon,
    RocketIcon,
    SettingsIcon,
    ShieldIcon,
    SparklesIcon,
    StarIcon,
    UsersIcon,
    WrenchIcon,
    ZapIcon,
    type LucideIcon,
} from 'lucide-react';

import Image from '@/components/image';
import { cn } from '@/lib/utils';

// A blog category's `icon` is a free-text admin field and lucide-react ships no by-name lookup,
// so only the names below resolve. Exported so the admin field can offer them as a picker.
const COLLECTION_ICONS: Record<string, LucideIcon> = {
    bell: BellIcon,
    bot: BotIcon,
    'book-open': BookOpenIcon,
    briefcase: BriefcaseIcon,
    code: CodeXmlIcon,
    'code-2': CodeXmlIcon,
    'code-xml': CodeXmlIcon,
    compass: CompassIcon,
    database: DatabaseIcon,
    'file-text': FileTextIcon,
    folder: FolderIcon,
    globe: GlobeIcon,
    'graduation-cap': GraduationCapIcon,
    layers: LayersIcon,
    'life-buoy': LifeBuoyIcon,
    lightbulb: LightbulbIcon,
    lock: LockIcon,
    'message-square': MessageSquareIcon,
    palette: PaletteIcon,
    puzzle: PuzzleIcon,
    rocket: RocketIcon,
    settings: SettingsIcon,
    shield: ShieldIcon,
    sparkles: SparklesIcon,
    star: StarIcon,
    users: UsersIcon,
    wrench: WrenchIcon,
    zap: ZapIcon,
};

export const COLLECTION_ICON_NAMES = Object.keys(COLLECTION_ICONS);

type CollectionIconSize = 'sm' | 'md' | 'lg';

export interface CollectionIconProps {
    icon?: string;
    alt?: string;
    variant?: 'tile' | 'bare';
    size?: CollectionIconSize;
    className?: string;
}

const TILE_SIZE: Record<CollectionIconSize, string> = {
    sm: 'size-8 rounded-lg',
    md: 'size-12 rounded-xl',
    lg: 'size-14 rounded-2xl',
};

const GLYPH_SIZE: Record<CollectionIconSize, string> = {
    sm: 'size-4',
    md: 'size-[22px]',
    lg: 'size-6',
};

const isImageSource = (icon: string) => /^(https?:|data:|\/)/i.test(icon);

const CollectionIcon = (props: CollectionIconProps) => {
    const { icon, alt, variant = 'tile', size = 'md', className } = props;
    const trimmedIcon = icon?.trim() ?? '';
    const Glyph = COLLECTION_ICONS[trimmedIcon.toLowerCase()] ?? FolderIcon;

    if (variant === 'bare') {
        if (trimmedIcon && isImageSource(trimmedIcon)) {
            return (
                <span className={cn('collection-icon inline-flex shrink-0 overflow-hidden rounded-sm', className)}>
                    <Image
                        src={trimmedIcon}
                        alt={alt ?? ''}
                        placeholder={'/assets/images/broken-image.svg'}
                        className={cn(GLYPH_SIZE[size], 'object-cover')}
                    />
                </span>
            );
        }

        return <Glyph className={cn('collection-icon shrink-0', GLYPH_SIZE[size], className)} aria-hidden="true" />;
    }

    return (
        <span
            className={cn(
                'collection-icon collection-icon-tile flex shrink-0 items-center justify-center overflow-hidden',
                'bg-primary text-primary-foreground',
                TILE_SIZE[size],
                className,
            )}
        >
            {trimmedIcon && isImageSource(trimmedIcon) ? (
                <Image
                    src={trimmedIcon}
                    alt={alt ?? ''}
                    placeholder={'/assets/images/broken-image.svg'}
                    className="size-full object-cover"
                />
            ) : (
                <Glyph className={GLYPH_SIZE[size]} aria-hidden="true" />
            )}
        </span>
    );
};

export default CollectionIcon;
