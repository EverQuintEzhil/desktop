import type { ChangeEvent } from 'react';
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Dropzone from '@/components/dropzone';
import { cn } from '@/lib/utils';

import SkillEditorPane from './skill-editor-pane';
import SkillsSidebar from './skills-sidebar';
import { useSkillZipUpload } from './use-skill-zip-upload';

const Skills = () => {
    const navigate = useNavigate();
    const { skillId } = useParams<{ skillId: string }>();
    const [selection, setSelection] = useState<{ skillId?: string; file: string | null }>({ file: null });

    const selectedFile = selection.skillId === skillId ? selection.file : null;

    const handleSelectFile = (file: string | null) => {
        setSelection({ skillId, file });
    };

    const handleSelectSkill = useCallback(
        (id: string) => {
            navigate(`/settings/skills/${id}`);
        },
        [navigate],
    );

    const { isUploading, uploadFile } = useSkillZipUpload({ onUploaded: handleSelectSkill });

    const handleDropzoneChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];

            if (file) void uploadFile(file);
        },
        [uploadFile],
    );

    return (
        <Dropzone
            global
            multiple={false}
            accept=".zip"
            onChange={handleDropzoneChange}
            uploading={isUploading}
            disabled={isUploading}
            className="flex flex-col bg-muted/30 lg:-mx-8 lg:-my-6 lg:h-svh lg:min-h-0 lg:flex-row lg:overflow-hidden"
        >
            <SkillsSidebar
                selectedSkillId={skillId}
                onSelectSkill={handleSelectSkill}
                isUploading={isUploading}
                onUploadFile={(file) => void uploadFile(file)}
                className={cn('w-full lg:w-80 lg:shrink-0', skillId && 'hidden lg:flex')}
            />
            <SkillEditorPane
                skillId={skillId}
                selectedFile={selectedFile}
                onSelectFile={handleSelectFile}
                onBack={() => navigate('/settings/skills')}
                className={cn(
                    'w-full min-w-0 flex-1 bg-background p-4 lg:h-full lg:overflow-y-auto',
                    !skillId && 'hidden lg:flex',
                )}
            />
        </Dropzone>
    );
};

export default Skills;
