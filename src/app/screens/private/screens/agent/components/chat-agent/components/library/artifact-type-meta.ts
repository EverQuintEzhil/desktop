import { CodeIcon, FileTextIcon, GitBranchIcon, GlobeIcon, ImageIcon, type LucideIcon } from 'lucide-react';

import { ARTIFACT_TYPE_LABELS, ARTIFACT_TYPES } from '@/components/agent-chat/artifact/artifact-types';
import type { ArtifactType } from '@/lib/api/app/artifact';

interface ArtifactTypeMeta {
    label: string;
    Icon: LucideIcon;
}

const ARTIFACT_TYPE_ICONS: Record<ArtifactType, LucideIcon> = {
    html: GlobeIcon,
    svg: ImageIcon,
    mermaid: GitBranchIcon,
    markdown: FileTextIcon,
    code: CodeIcon,
};

export const ARTIFACT_TYPE_ORDER = ARTIFACT_TYPES;

export const artifactTypeMeta = (type: ArtifactType): ArtifactTypeMeta => ({
    label: ARTIFACT_TYPE_LABELS[type],
    Icon: ARTIFACT_TYPE_ICONS[type],
});
