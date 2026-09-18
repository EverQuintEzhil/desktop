import { FolderMinusIcon, PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PlusDropdownOption } from '@/types/chat';

import ConnectorsSubmenu, { type ConnectorsSubmenuProps } from './connectors-submenu';
import MemoriesSubmenu, { type MemoriesSubmenuProps } from './memories-submenu';
import SkillsSubmenu, { type SkillsSubmenuProps } from './skills-submenu';
import SpacesSubmenu, { type SpacesSubmenuProps } from './spaces-submenu';
import './plus-dropdown.scss';

export interface Props {
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
    onSelect: (option: PlusDropdownOption) => void;
    options: PlusDropdownOption[];
    align?: 'start' | 'center' | 'end';
    side?: 'top' | 'right' | 'bottom' | 'left';
    isDarkMode?: boolean;
    connectors?: ConnectorsSubmenuProps;
    skills?: SkillsSubmenuProps;
    memories?: MemoriesSubmenuProps;
    spaces?: SpacesSubmenuProps;
    onTriggerMouseDown?: () => void;
}

const PlusDropdown = (props: Props) => {
    const {
        isOpen,
        onToggle,
        onClose,
        onSelect,
        options,
        align = 'start',
        side = 'bottom',
        isDarkMode = false,
        connectors,
        skills,
        memories,
        spaces,
        onTriggerMouseDown,
    } = props;

    // When the menu opens upward, bottom-align submenus so they expand up instead of overflowing below.
    const submenuAlign = side === 'top' ? 'end' : 'start';

    const renderOptions = () =>
        options.map((option) => (
            <DropdownMenuItem
                key={option.value}
                onClick={() => onSelect(option)}
                className="dropdown-menu-item cursor-pointer rounded-md p-2 text-foreground hover:bg-background"
            >
                {option.icon ? <option.icon className="h-4 w-4" /> : null}
                <span>{option.label}</span>
            </DropdownMenuItem>
        ));

    const renderConnectors = () => {
        if (!connectors) {
            return null;
        }

        return (
            <>
                {options.length > 0 || skills || memories ? <DropdownMenuSeparator /> : null}
                <ConnectorsSubmenu {...connectors} align="end" />
            </>
        );
    };

    const renderSkills = () => {
        if (!skills) {
            return null;
        }

        return (
            <>
                {options.length > 0 || memories ? <DropdownMenuSeparator /> : null}
                <SkillsSubmenu {...skills} align="end" />
            </>
        );
    };

    const renderMemories = () => {
        if (!memories) {
            return null;
        }

        return (
            <>
                {options.length > 0 ? <DropdownMenuSeparator /> : null}
                <MemoriesSubmenu {...memories} align={submenuAlign} />
            </>
        );
    };

    const renderSpaces = () => {
        if (!spaces) {
            return null;
        }

        return (
            <>
                {options.length > 0 || memories ? <DropdownMenuSeparator /> : null}
                <SpacesSubmenu {...spaces} align={submenuAlign} />
                {spaces.selectedProjectId ? (
                    <DropdownMenuItem
                        onClick={() => spaces.onSelect(null)}
                        className="dropdown-menu-item cursor-pointer rounded-md p-2 text-foreground hover:bg-background"
                    >
                        <FolderMinusIcon className="h-4 w-4" />
                        <span>Remove from space</span>
                    </DropdownMenuItem>
                ) : null}
            </>
        );
    };

    return (
        <DropdownMenuRoot
            open={isOpen}
            onOpenChange={(open) => {
                if (open) {
                    onToggle();
                } else {
                    onClose();
                }
            }}
        >
            <DropdownMenuTrigger asChild>
                <Button
                    variant={isDarkMode ? 'black' : 'outline'}
                    size="icon-sm"
                    className={`button-plus size-8 justify-center rounded-full ${isDarkMode ? 'dark-mode' : ''}`}
                    aria-label="Add to message"
                    onMouseDown={onTriggerMouseDown}
                >
                    <PlusIcon />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                side={side}
                align={align}
                sideOffset={4}
                className={`plus-dropdown-content w-auto min-w-56 p-2 ${isDarkMode ? 'dark-mode' : ''}`}
            >
                {renderOptions()}
                {renderSpaces()}
                {renderMemories()}
                {renderSkills()}
                {renderConnectors()}
            </DropdownMenuContent>
        </DropdownMenuRoot>
    );
};

export default PlusDropdown;
