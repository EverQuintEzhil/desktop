import React from 'react';

import type { SkillType } from '@/types/admin';

export interface SkillInstructionsProps {
    skill: SkillType;
    headerContent?: React.ReactNode;
    footerContent?: React.ReactNode;
    isModal?: boolean;
    readOnly?: boolean;
}

export interface SkillFileListItem {
    path: string;
    isFolder: boolean;
    isProtected?: boolean;
    content?: string;
}

export type SkillFileApiEntry = {
    path: string;
    kind?: string;
    isFolder?: boolean;
    content?: string;
    metadata?: { isFolder?: boolean; isProtected?: boolean };
};
