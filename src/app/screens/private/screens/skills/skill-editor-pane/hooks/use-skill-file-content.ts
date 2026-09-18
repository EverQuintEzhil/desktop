import { isCancel } from 'axios';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { MarkdownViewMode } from '@/components/markdown/markdown-view-toggle';
import { skillsApi } from '@/lib/api/common/skills';
import { showErrorToast } from '@/utils';

import { getErrorToastMessage } from '../utils/get-error-toast-message';
import { isViewableTextFile } from '../utils/is-file-type';

export const useSkillFileContent = (skillId: string | undefined, selectedFile: string | null) => {
    const [fileContent, setFileContent] = useState('');
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [mdViewMode, setMdViewMode] = useState<MarkdownViewMode>('rendered');

    const fileRequestRef = useRef<AbortController | null>(null);

    const loadFileContent = useCallback(async (id: string, path: string) => {
        fileRequestRef.current?.abort();

        const controller = new AbortController();

        fileRequestRef.current = controller;

        try {
            setIsLoadingFile(true);
            const fileData = await skillsApi.getFile(id, path, { signal: controller.signal });

            setFileContent(fileData.content || '');
        } catch (error) {
            // A superseded request rejects here; its toast and its loading flag both belong to
            // a file the user is no longer looking at.
            if (isCancel(error)) return;

            showErrorToast(getErrorToastMessage(error, 'Failed to load file content.'));
            setFileContent('');
        } finally {
            if (!controller.signal.aborted) {
                setIsLoadingFile(false);
            }
        }
    }, []);

    useLayoutEffect(() => {
        setMdViewMode('rendered');

        if (!skillId || !selectedFile || !isViewableTextFile(selectedFile)) {
            fileRequestRef.current?.abort();
            setFileContent('');
            setIsLoadingFile(false);

            return;
        }

        setFileContent('');
        void loadFileContent(skillId, selectedFile);

        return () => {
            fileRequestRef.current?.abort();
        };
    }, [skillId, selectedFile, loadFileContent]);

    // Read through a ref, not the closure: callers await an upload and a mutation first, and the
    // user can select a different file meanwhile. The stale closure would abort the layout effect's
    // request for the new selection and write the old file's content in its place.
    const selectionRef = useRef({ skillId, selectedFile });

    selectionRef.current = { skillId, selectedFile };

    const reloadCurrentFile = useCallback(async () => {
        const { skillId: currentSkillId, selectedFile: currentFile } = selectionRef.current;

        if (!currentSkillId || !currentFile || !isViewableTextFile(currentFile)) return;

        await loadFileContent(currentSkillId, currentFile);
    }, [loadFileContent]);

    return {
        fileContent,
        isLoadingFile,
        mdViewMode,
        setMdViewMode,
        reloadCurrentFile,
    };
};
