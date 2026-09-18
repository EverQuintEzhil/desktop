import cloneDeep from 'lodash/cloneDeep';
import { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import type { ReactNode } from 'react';

import type { FileType } from '@/types/chat';

interface UploadFilesState {
    files: FileType[];
    isUploading: boolean;
}

interface UploadFilesActions {
    setFiles: (files: FileType[]) => void;
    updateFileById: (fileId: string, updates: Partial<FileType>) => void;
    resetState: () => void;
}

interface UploadFilesContextType {
    state: UploadFilesState;
    actions: UploadFilesActions;
}

// Initial state
const initialState: UploadFilesState = {
    files: [],
    isUploading: false,
};

const SET_FILES = 'SET_FILES';
const UPDATE_FILE_BY_ID = 'UPDATE_FILE_BY_ID';
const RESET_STATE = 'RESET_STATE';

// Action types
type UploadFilesAction =
    | { type: typeof SET_FILES; payload: FileType[] }
    | { type: typeof UPDATE_FILE_BY_ID; payload: { fileId: string; updates: Partial<FileType> } }
    | { type: typeof RESET_STATE };

// Reducer
const uploadFilesReducer = (state: UploadFilesState, action: UploadFilesAction): UploadFilesState => {
    switch (action.type) {
        case RESET_STATE:
            return {
                ...initialState,
            };
        case SET_FILES:
            return { ...state, files: action.payload };
        case UPDATE_FILE_BY_ID: {
            const tempFiles = cloneDeep(state.files);
            const index = tempFiles.findIndex((f) => f.tempId === action.payload.fileId);

            if (index !== -1) {
                tempFiles[index] = { ...tempFiles[index], ...action.payload.updates };
            }

            return {
                ...state,
                files: tempFiles,
            };
        }
        default:
            return state;
    }
};

// Create context
const UploadFilesContext = createContext<UploadFilesContextType | undefined>(undefined);

// Custom hook to use uploadFiles context
export const useUploadFilesContext = (): UploadFilesContextType => {
    const context = useContext(UploadFilesContext);

    if (!context) {
        throw new Error('useUploadFilesContext must be used within a UploadFilesProvider');
    }

    return context;
};

// Provider component
interface UploadFilesProviderProps {
    children: ReactNode;
}

export const UploadFilesProvider: React.FC<UploadFilesProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(uploadFilesReducer, initialState);
    const stateRef = useRef(state);

    stateRef.current = state;

    useEffect(() => {
        return () => {
            stateRef.current.files.forEach((f) => {
                if (f.url?.startsWith('blob:')) URL.revokeObjectURL(f.url);
            });
        };
    }, []);

    const computedState = {
        ...state,
        isUploading: state.files.some((file) => file.isUploading),
    };

    const revokeRemovedObjectURLs = (nextFiles: FileType[]) => {
        const nextIds = new Set(nextFiles.map((f) => f.tempId));

        stateRef.current.files.forEach((f) => {
            if (!nextIds.has(f.tempId) && f.url?.startsWith('blob:')) {
                URL.revokeObjectURL(f.url);
            }
        });
    };

    const actions: UploadFilesActions = {
        setFiles: (files) => {
            revokeRemovedObjectURLs(files);
            dispatch({ type: SET_FILES, payload: files });
        },
        updateFileById: (fileId: string, updates: Partial<FileType>) => {
            if (updates.url && !updates.url.startsWith('blob:')) {
                const existing = stateRef.current.files.find((f) => f.tempId === fileId);

                if (existing?.url?.startsWith('blob:')) {
                    URL.revokeObjectURL(existing.url);
                }
            }
            dispatch({ type: UPDATE_FILE_BY_ID, payload: { fileId, updates } });
        },
        resetState: () => {
            stateRef.current.files.forEach((f) => {
                if (f.url?.startsWith('blob:')) URL.revokeObjectURL(f.url);
            });
            dispatch({ type: RESET_STATE });
        },
    };

    const contextValue: UploadFilesContextType = {
        state: computedState,
        actions,
    };

    return <UploadFilesContext.Provider value={contextValue}>{children}</UploadFilesContext.Provider>;
};

export default UploadFilesContext;
