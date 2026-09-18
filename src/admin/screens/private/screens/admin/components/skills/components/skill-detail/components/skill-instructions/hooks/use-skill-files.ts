import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import {
    skillsApi,
    useCreateSkillFileMutation,
    useEditSkillFileMutation,
    useCreateSkillFolderMutation,
    useSkillFilesQuery,
    SKILLS_QUERY_KEY,
    useRenameSkillFileMutation,
    useDeleteSkillFileMutation,
    useUploadSkillFileMutation,
} from '@/lib/api/common/skills';
import { filesApi } from '@/lib/api/files-client';
import type { SkillType } from '@/types/admin';
import { showErrorToast } from '@/utils';

import type { SkillFileApiEntry, SkillFileListItem } from '../types';
import {
    DEFAULT_SKILL_FILE,
    FILE_EXTENSION_ERROR,
    getErrorToastMessage,
    hasFileExtension,
    isEditableFile,
    normalizeSkillFileEntries,
    sortTreeItems,
} from '../utils';

export const useSkillFiles = (skill: Pick<SkillType, '_id'>) => {
    const rootPath = `skills/${skill._id}/`;
    const queryClient = useQueryClient();
    const renameSkillFileMutation = useRenameSkillFileMutation();
    const deleteSkillFileMutation = useDeleteSkillFileMutation();
    const createSkillFileMutation = useCreateSkillFileMutation();
    const createSkillFolderMutation = useCreateSkillFolderMutation();
    const editSkillFileMutation = useEditSkillFileMutation();
    const uploadSkillFileMutation = useUploadSkillFileMutation();

    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState('');
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [isUploadingLocalFile, setIsUploadingLocalFile] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [currentPath, setCurrentPath] = useState<string>('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
    const [loadingFolders, setLoadingFolders] = useState<Set<string>>(() => new Set());
    const [isRenamingInline, setIsRenamingInline] = useState(false);
    const [inlineRenameValue, setInlineRenameValue] = useState('');
    const [renamingListPath, setRenamingListPath] = useState<string | null>(null);
    const [listRenameValue, setListRenameValue] = useState('');
    const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; path: string }>({
        isOpen: false,
        path: '',
    });
    const [mobileView, setMobileView] = useState<'explorer' | 'content'>('explorer');
    const [addingInline, setAddingInline] = useState<{ parentPath: string; mode: 'file' | 'folder' } | null>(null);
    const [newFileName, setNewFileName] = useState('');

    const pendingSaveRef = useRef<{ path: string; content: string } | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasInitializedRootRef = useRef(false);
    const loadTokenRef = useRef(0);

    // Token guards against a superseded load clobbering a newer one or leaving the spinner stuck.
    const loadFileContent = useCallback(
        async (path: string) => {
            const token = loadTokenRef.current + 1;

            loadTokenRef.current = token;

            if (!isEditableFile(path)) {
                setFileContent('');
                setIsDirty(false);
                setIsLoadingFile(false);

                return;
            }

            try {
                setIsLoadingFile(true);
                setFileContent('');

                const fileData = await skillsApi.getFile(skill._id, path);

                if (loadTokenRef.current !== token) return;

                setFileContent(fileData.content || '');
                setIsDirty(false);
            } catch (error) {
                if (loadTokenRef.current !== token) return;

                showErrorToast(getErrorToastMessage(error, 'Failed to load file content.'));
                setFileContent('');
                setIsDirty(false);
            } finally {
                if (loadTokenRef.current === token) {
                    setIsLoadingFile(false);
                }
            }
        },
        [skill._id],
    );

    const flushSave = useCallback(async () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }

        if (pendingSaveRef.current) {
            const { path, content } = pendingSaveRef.current;

            pendingSaveRef.current = null;

            try {
                await editSkillFileMutation.mutateAsync({ id: skill._id, data: { path, content } });
                if (!pendingSaveRef.current) {
                    setIsDirty(false);
                }
            } catch (error) {
                showErrorToast(getErrorToastMessage(error, `Failed to auto-save ${path}.`));
            }
        }
    }, [editSkillFileMutation, skill._id]);

    const handleContentChange = useCallback(
        (val: string) => {
            if (val === fileContent) return;

            setFileContent(val);
            setIsDirty(true);

            if (selectedFile) {
                pendingSaveRef.current = { path: selectedFile, content: val };

                if (saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current);
                }

                saveTimeoutRef.current = setTimeout(() => {
                    void flushSave();
                }, 1000);
            }
        },
        [selectedFile, flushSave, fileContent],
    );

    useEffect(() => {
        return () => {
            if (pendingSaveRef.current) {
                editSkillFileMutation.mutate({ id: skill._id, data: pendingSaveRef.current });
                pendingSaveRef.current = null;
            }
        };
    }, []);

    const {
        data: folderFiles,
        error: folderFilesError,
        isError: isFolderFilesError,
        isFetching: isFetchingRoot,
        isLoading: isLoadingRoot,
    } = useSkillFilesQuery(skill._id, '');

    const getFolderItems = useCallback(
        (folderPath: string): SkillFileListItem[] => {
            const data =
                folderPath === ''
                    ? folderFiles
                    : queryClient.getQueryData<SkillFileApiEntry[]>([
                          ...SKILLS_QUERY_KEY,
                          'detail',
                          skill._id,
                          'files',
                          folderPath,
                      ]);

            return sortTreeItems(normalizeSkillFileEntries(data, folderPath, rootPath));
        },
        [folderFiles, queryClient, rootPath, skill._id],
    );

    const rootItems = useMemo(() => getFolderItems(''), [getFolderItems]);

    const findFileByPath = useCallback(
        (path: string): SkillFileListItem | undefined => {
            const queries = queryClient.getQueriesData<SkillFileApiEntry[]>({
                queryKey: [...SKILLS_QUERY_KEY, 'detail', skill._id, 'files'],
            });

            for (const [queryKey, data] of queries) {
                const folderPath = (queryKey as readonly unknown[])[
                    (queryKey as readonly unknown[]).length - 1
                ] as string;
                const found = normalizeSkillFileEntries(data, folderPath, rootPath).find((item) => item.path === path);

                if (found) {
                    return found;
                }
            }

            return undefined;
        },
        [queryClient, rootPath, skill._id],
    );

    const selectedFileEntry = useMemo(() => {
        if (!selectedFile) {
            return undefined;
        }

        return findFileByPath(selectedFile);
    }, [findFileByPath, selectedFile]);

    const isSelectedFileProtected = Boolean(
        selectedFileEntry?.isProtected ||
        (selectedFile !== null && !selectedFile.includes('/') && selectedFile === DEFAULT_SKILL_FILE),
    );

    const ensureFolderLoaded = useCallback(
        async (folderPath: string, force = false) => {
            const queryKey = [...SKILLS_QUERY_KEY, 'detail', skill._id, 'files', folderPath];

            if (!force && queryClient.getQueryData(queryKey)) {
                return;
            }

            setLoadingFolders((prev) => new Set(prev).add(folderPath));

            try {
                if (force) {
                    await queryClient.invalidateQueries({ queryKey, exact: true });
                }

                await queryClient.fetchQuery({
                    queryKey,
                    queryFn: () => skillsApi.getFiles(skill._id, folderPath),
                });
            } finally {
                setLoadingFolders((prev) => {
                    const next = new Set(prev);

                    next.delete(folderPath);

                    return next;
                });
            }
        },
        [queryClient, skill._id],
    );

    const expandAncestorFolders = useCallback(
        async (filePath: string) => {
            const parts = filePath.split('/');

            if (parts.length <= 1) {
                return;
            }

            const ancestors: string[] = [];
            let accumulatedPath = '';

            for (const part of parts.slice(0, -1)) {
                accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
                ancestors.push(accumulatedPath);
            }

            setExpandedFolders((prev) => {
                const next = new Set(prev);

                ancestors.forEach((path) => next.add(path));

                return next;
            });

            await Promise.all(ancestors.map((path) => ensureFolderLoaded(path)));
        },
        [ensureFolderLoaded],
    );

    const toggleFolderExpanded = useCallback(
        async (folderPath: string) => {
            if (expandedFolders.has(folderPath)) {
                setExpandedFolders((prev) => {
                    const next = new Set(prev);

                    next.delete(folderPath);

                    return next;
                });

                return;
            }

            setExpandedFolders((prev) => new Set(prev).add(folderPath));
            await ensureFolderLoaded(folderPath);
        },
        [ensureFolderLoaded, expandedFolders],
    );

    useEffect(() => {
        if (!isFolderFilesError) return;

        showErrorToast(getErrorToastMessage(folderFilesError, 'Failed to load folder contents.'));
    }, [folderFilesError, isFolderFilesError]);

    useEffect(() => {
        if (hasInitializedRootRef.current) return;

        const defaultFile = rootItems.find((file) => file.path === DEFAULT_SKILL_FILE && !file.isFolder);

        if (!defaultFile) return;

        hasInitializedRootRef.current = true;

        setSelectedFile(defaultFile.path);

        if (defaultFile.content !== undefined && defaultFile.content !== '') {
            setFileContent(defaultFile.content);
            setIsDirty(false);
            setIsLoadingFile(false);

            return;
        }

        void loadFileContent(defaultFile.path);
    }, [rootItems, loadFileContent]);

    const isAddingFileOrFolder = createSkillFileMutation.isPending || createSkillFolderMutation.isPending;
    const isRenamingFile = renameSkillFileMutation.isPending;
    const isSavingFileContent = editSkillFileMutation.isPending;
    const isUploadingFile = uploadSkillFileMutation.isPending || isUploadingLocalFile;

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;

        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);

        try {
            setIsUploadingLocalFile(true);
            for (const file of fileArray) {
                const formData = new FormData();

                formData.append('file', file);
                formData.append('origin.type', 'skill');
                formData.append('origin.skill_id', skill._id);

                const uploadResponse = await filesApi.upload(formData);
                const fileId = uploadResponse.data?.value?.values?.[0]?._id;

                if (!fileId) {
                    throw new Error('Failed to get file ID from upload response');
                }

                const payload: { fileId: string; path?: string; folder?: string } = { fileId };

                if (currentPath) {
                    payload.folder = currentPath;
                }

                if (!file.name.toLowerCase().endsWith('.zip')) {
                    payload.path = file.name;
                }

                await uploadSkillFileMutation.mutateAsync({
                    id: skill._id,
                    payload,
                });
            }
            await ensureFolderLoaded(currentPath, true);
        } catch (error) {
            showErrorToast(getErrorToastMessage(error, 'Failed to upload file.'));
        } finally {
            setIsUploadingLocalFile(false);
            event.target.value = '';
        }
    };

    const handleSaveAdd = async () => {
        if (!newFileName.trim() || isAddingFileOrFolder || !addingInline) return;

        const isFolder = addingInline.mode === 'folder';
        const trimmedFileName = newFileName.trim();

        if (!isFolder && !hasFileExtension(trimmedFileName)) {
            showErrorToast(FILE_EXTENSION_ERROR);

            return;
        }

        const pathPayload = addingInline.parentPath ? `${addingInline.parentPath}/${trimmedFileName}` : trimmedFileName;

        try {
            if (isFolder) {
                await createSkillFolderMutation.mutateAsync({ id: skill._id, data: { path: pathPayload } });
            } else {
                await createSkillFileMutation.mutateAsync({ id: skill._id, data: { path: pathPayload } });
            }
            if (currentPath) {
                setExpandedFolders((prev) => new Set(prev).add(currentPath));
            }
            await ensureFolderLoaded(addingInline.parentPath, true);
            setAddingInline(null);
            setNewFileName('');
        } catch (error) {
            showErrorToast(getErrorToastMessage(error, `Failed to add ${isFolder ? 'folder' : 'file'}.`));
        }
    };

    const handleStartAdd = async (mode: 'file' | 'folder') => {
        setAddingInline({ parentPath: currentPath, mode });
        setNewFileName('');
        if (currentPath) {
            setExpandedFolders((prev) => new Set(prev).add(currentPath));
            await ensureFolderLoaded(currentPath, false);
        }
    };

    const handleSaveRename = async () => {
        if (!selectedFile || !inlineRenameValue.trim() || isRenamingFile) {
            setIsRenamingInline(false);
            setInlineRenameValue('');

            return;
        }

        const trimmedRenameValue = inlineRenameValue.trim();
        const currentName = selectedFile.split('/').pop() || selectedFile;

        if (trimmedRenameValue === currentName) {
            setIsRenamingInline(false);
            setInlineRenameValue('');

            return;
        }

        if (!hasFileExtension(trimmedRenameValue)) {
            showErrorToast(FILE_EXTENSION_ERROR);

            return;
        }

        const basePath = selectedFile.split('/').slice(0, -1).join('/');
        const newPathPayload = basePath ? `${basePath}/${trimmedRenameValue}` : trimmedRenameValue;

        try {
            await renameSkillFileMutation.mutateAsync({
                id: skill._id,
                data: { path: selectedFile, newPath: newPathPayload },
            });
            await ensureFolderLoaded(basePath, true);
            setSelectedFile(newPathPayload);
            setIsRenamingInline(false);
            setInlineRenameValue('');
        } catch (error) {
            showErrorToast(getErrorToastMessage(error, 'Failed to rename file.'));
        }
    };

    const handleCancelListRename = useCallback(() => {
        setRenamingListPath(null);
        setListRenameValue('');
    }, []);

    const handleSaveListRename = async (path: string, isFolder: boolean) => {
        if (!listRenameValue.trim() || isRenamingFile) {
            setRenamingListPath(null);
            setListRenameValue('');

            return;
        }

        const trimmedRenameValue = listRenameValue.trim();
        const currentName = path.split('/').pop() || path;

        if (trimmedRenameValue === currentName) {
            setRenamingListPath(null);
            setListRenameValue('');

            return;
        }

        if (!isFolder && !hasFileExtension(trimmedRenameValue)) {
            showErrorToast(FILE_EXTENSION_ERROR);

            return;
        }

        const basePath = path.split('/').slice(0, -1).join('/');
        const newPathPayload = basePath ? `${basePath}/${trimmedRenameValue}` : trimmedRenameValue;

        try {
            await renameSkillFileMutation.mutateAsync({
                id: skill._id,
                data: { path, newPath: newPathPayload },
            });
            await ensureFolderLoaded(basePath, true);
            if (selectedFile === path) {
                setSelectedFile(newPathPayload);
            } else if (isFolder && selectedFile?.startsWith(path + '/')) {
                const relativePath = selectedFile.slice(path.length);

                setSelectedFile(newPathPayload + relativePath);
            }
            setRenamingListPath(null);
            setListRenameValue('');
        } catch (error) {
            showErrorToast(getErrorToastMessage(error, `Failed to rename ${isFolder ? 'folder' : 'file'}.`));
        }
    };

    const handleConfirmDelete = async (pathOverride?: string) => {
        const pathToDelete = typeof pathOverride === 'string' ? pathOverride : deleteModalState.path;

        if (!pathToDelete || deleteSkillFileMutation.isPending) return;

        try {
            await deleteSkillFileMutation.mutateAsync({
                id: skill._id,
                path: pathToDelete,
            });
            const basePath = pathToDelete.split('/').slice(0, -1).join('/');

            await ensureFolderLoaded(basePath, true);

            if (selectedFile === pathToDelete || selectedFile?.startsWith(pathToDelete + '/')) {
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                pendingSaveRef.current = null;
                setSelectedFile(null);
                setFileContent('');
                setIsDirty(false);
            }
            setDeleteModalState({ isOpen: false, path: '' });
        } catch (error) {
            showErrorToast(getErrorToastMessage(error, 'Failed to delete file.'));
        }
    };

    const handleSelectFile = async (file: SkillFileListItem) => {
        await flushSave();

        if (!file.isFolder) {
            setSelectedFile(file.path);
            setIsDirty(false);

            if (file.content !== undefined && file.content !== '') {
                loadTokenRef.current += 1;
                setIsLoadingFile(false);
                setFileContent(file.content);

                return;
            }

            await loadFileContent(file.path);
        }
    };

    return {
        selectedFile,
        setSelectedFile,
        fileContent,
        setFileContent,
        handleContentChange,
        isLoadingFile,
        isDirty,
        setIsDirty,
        currentPath,
        setCurrentPath,
        expandedFolders,
        toggleFolderExpanded,
        loadingFolders,
        isRenamingInline,
        setIsRenamingInline,
        inlineRenameValue,
        setInlineRenameValue,
        handleSaveRename,
        renamingListPath,
        setRenamingListPath,
        listRenameValue,
        setListRenameValue,
        handleSaveListRename,
        handleCancelListRename,
        isRenamingFile,
        deleteModalState,
        setDeleteModalState,
        handleConfirmDelete,
        isDeletingFile: deleteSkillFileMutation.isPending,
        mobileView,
        setMobileView,
        addingInline,
        setAddingInline,
        handleStartAdd,
        handleSaveAdd,
        isAddingFileOrFolder,
        newFileName,
        setNewFileName,
        isFetchingRoot,
        rootItems,
        getFolderItems,
        isSelectedFileProtected,
        isSavingFileContent,
        isUploadingFile,
        handleFileChange,
        expandAncestorFolders,
        handleSelectFile,
        isFolderFilesError,
        folderFilesError,
        isLoadingRoot,
    };
};
