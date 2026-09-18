import { Globe, SettingsIcon, UserRoundIcon, ZapIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TruncatedLabel } from '@/components/ui/truncated-label';
import type { SkillType } from '@/types/admin';

import { INDICATOR_BOX_CLASS, STATIC_ROW_CLASS, toggleRowKeyDown } from './constants';
import SubmenuSearchInput from './submenu-search-input';

const SEARCH_THRESHOLD = 10;

export interface SkillsSubmenuProps {
    skills: SkillType[];
    enabledIds: string[];
    customIds?: string[];
    sharedIds?: string[];
    onToggle: (skillId: string) => void;
    onManage?: () => void;
    align?: 'start' | 'end';
}

const SkillsSubmenu = ({
    skills,
    enabledIds,
    customIds = [],
    sharedIds = [],
    onToggle,
    onManage,
    align = 'start',
}: SkillsSubmenuProps) => {
    const [search, setSearch] = useState('');
    const showSearch = skills.length > SEARCH_THRESHOLD;

    const filteredSkills = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) return skills;

        return skills.filter((skill) => skill.name.toLowerCase().includes(query));
    }, [skills, search]);
    const renderCustomIndicator = (skillId: string) => {
        if (!customIds.includes(skillId)) {
            return null;
        }

        return (
            <TooltipProvider>
                <Tooltip disableHoverableContent>
                    <TooltipTrigger asChild>
                        <span className={INDICATOR_BOX_CLASS}>
                            <UserRoundIcon className="size-3.5 text-primary" aria-label="Your custom skill" />
                        </span>
                    </TooltipTrigger>
                    <TooltipContent className="pointer-events-none! z-52">Your custom skill</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    const renderSharedIndicator = (skillId: string) => {
        if (!sharedIds.includes(skillId)) {
            return null;
        }

        return (
            <TooltipProvider>
                <Tooltip disableHoverableContent>
                    <TooltipTrigger asChild>
                        <span className={INDICATOR_BOX_CLASS}>
                            <Globe className="size-3.5 text-primary" aria-label="Enterprise skill" />
                        </span>
                    </TooltipTrigger>
                    <TooltipContent className="pointer-events-none! z-52">Enterprise</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    const renderToggleRow = (skill: SkillType) => (
        <DropdownMenuItem
            key={skill._id}
            onSelect={(e) => e.preventDefault()}
            onKeyDown={toggleRowKeyDown(() => onToggle(skill._id))}
            data-static-row
            className={STATIC_ROW_CLASS}
        >
            <TruncatedLabel text={skill.name} />
            <span className="flex shrink-0 items-center gap-2">
                {renderCustomIndicator(skill._id)}
                {renderSharedIndicator(skill._id)}
                <ToggleSwitch
                    checked={enabledIds.includes(skill._id)}
                    onCheckedChange={() => onToggle(skill._id)}
                    aria-label={`Toggle ${skill.name}`}
                />
            </span>
        </DropdownMenuItem>
    );

    const renderSkills = () => {
        if (skills.length === 0) {
            return <DropdownMenuItem disabled>No skills available</DropdownMenuItem>;
        }

        if (filteredSkills.length === 0) {
            return <DropdownMenuItem disabled>No skills found</DropdownMenuItem>;
        }

        return filteredSkills.map(renderToggleRow);
    };

    const renderManageRow = () => {
        if (!onManage) {
            return null;
        }

        return (
            <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onManage} className="cursor-pointer">
                    <SettingsIcon className="h-4 w-4" />
                    <span>Manage skills</span>
                </DropdownMenuItem>
            </>
        );
    };

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                <ZapIcon className="h-4 w-4" />
                <span>Skills</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent align={align} className="w-[240px] p-0">
                {showSearch ? (
                    <div className="border-b border-border p-2">
                        <SubmenuSearchInput search={search} setSearch={setSearch} placeholder="Search skills" />
                    </div>
                ) : null}
                <div className="scrollbar-vertical scrollbar-controller max-h-[240px] py-1">{renderSkills()}</div>
                {renderManageRow()}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
};

export default SkillsSubmenu;
