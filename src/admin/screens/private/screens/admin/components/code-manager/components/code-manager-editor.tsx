import { oneDark } from '@codemirror/theme-one-dark';
import CodeMirror from '@uiw/react-codemirror';
import MDEditor from '@uiw/react-md-editor';
import { ChevronLeftIcon } from 'lucide-react';
import { useState } from 'react';
import type { Content, JSONContent } from 'vanilla-jsoneditor';

import { MarkdownEditor } from '@/components';
import JSONEditor from '@/components/json-editor';
import { Button } from '@/components/ui/button';
import TextAreaForm from '@/components/ui/textarea-form';
import { cn } from '@/lib/utils';
import type { AgentType, CodeLangEnum, CodeTypeEnum } from '@/types/admin';

import { AgentModelConfigEditor } from '../../agents/components/agent-detail/components/agent-model-config-editor';
import { AgentUiConfigEditor } from '../../agents/components/agent-detail/components/agent-ui-config-editor';
import type { CodeEditorField } from '../code-manager.types';
import { luaExtensions } from '../code-manager.utils';

interface CodeManagerEditorProps {
    field: CodeEditorField;
    selectedLang: CodeLangEnum;
    isReadOnly: boolean;
    onChangeRef: () => void;
    type?: CodeTypeEnum;
    agent?: AgentType;
    readOnlyReason?: 'default-version' | 'no-permission' | null;
    onRequestFork?: () => void;
}

interface MarkdownEditorPanelProps {
    field: CodeEditorField;
    isReadOnly: boolean;
    onChangeRef: () => void;
}

const MarkdownEditorPanel = ({ field, isReadOnly, onChangeRef }: MarkdownEditorPanelProps) => {
    const [previewOpen, setPreviewOpen] = useState(false);
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;

    let preview: 'live' | 'edit' | 'preview' = 'edit';

    if (isReadOnly) preview = 'preview';
    else if (isDesktop) preview = 'live';

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
            <MarkdownEditor
                value={field.state.value}
                onChange={(value) => {
                    onChangeRef();
                    field.handleChange(value);
                }}
                preview={preview}
                hideToolbar={isReadOnly}
                className="tool-code-mirror min-h-0 flex-1"
            />

            {/* slide-in preview overlay — tablet/mobile only */}
            <div
                className={cn(
                    'absolute inset-0 z-20 flex flex-col bg-card lg:hidden',
                    'transition-transform duration-300 ease-in-out',
                    previewOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full',
                )}
            >
                <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-3 py-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-text-secondary"
                        onClick={() => setPreviewOpen(false)}
                    >
                        <ChevronLeftIcon className="size-4" />
                        Editor
                    </Button>
                </div>
                <div className="scrollbar-controller scrollbar-vertical flex-1 p-4" data-color-mode="light">
                    <MDEditor.Markdown source={field.state.value} />
                </div>
            </div>
        </div>
    );
};

const CodeManagerEditor = ({
    field,
    selectedLang,
    isReadOnly,
    onChangeRef,
    type,
    agent,
    readOnlyReason,
    onRequestFork,
}: CodeManagerEditorProps) => {
    if (selectedLang === 'lua') {
        return (
            <CodeMirror
                value={field.state.value}
                theme={oneDark}
                extensions={luaExtensions}
                readOnly={isReadOnly}
                onChange={(value) => {
                    onChangeRef();
                    field.handleChange(value);
                }}
                basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    highlightSpecialChars: true,
                    foldGutter: true,
                    drawSelection: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                    syntaxHighlighting: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    rectangularSelection: true,
                    crosshairCursor: true,
                    highlightActiveLine: true,
                    highlightSelectionMatches: true,
                    closeBracketsKeymap: true,
                    defaultKeymap: true,
                    searchKeymap: true,
                    historyKeymap: true,
                    foldKeymap: true,
                    completionKeymap: true,
                    lintKeymap: true,
                    tabSize: 4,
                }}
                className="tool-code-mirror flex-1 overflow-hidden"
            />
        );
    }

    if (selectedLang === 'json') {
        if (type === 'agent_ui_config') {
            return (
                <AgentUiConfigEditor
                    code={field.state.value}
                    agent={agent}
                    readOnly={isReadOnly}
                    readOnlyReason={readOnlyReason ?? null}
                    onRequestFork={onRequestFork}
                    onChange={(nextCode) => {
                        onChangeRef();
                        field.handleChange(nextCode);
                    }}
                />
            );
        }

        if (type === 'agent_model_config') {
            return (
                <AgentModelConfigEditor
                    code={field.state.value}
                    agent={agent}
                    readOnly={isReadOnly}
                    readOnlyReason={readOnlyReason ?? null}
                    onRequestFork={onRequestFork}
                    onChange={(nextCode) => {
                        onChangeRef();
                        field.handleChange(nextCode);
                    }}
                />
            );
        }

        return (
            <JSONEditor
                content={{ text: field.state.value }}
                readOnly={isReadOnly}
                onChange={(content: Content) => {
                    const str =
                        'text' in content
                            ? (content as { text: string }).text
                            : JSON.stringify((content as JSONContent).json, null, 2);

                    onChangeRef();
                    field.handleChange(str);
                }}
            />
        );
    }

    if (selectedLang === 'markdown') {
        return <MarkdownEditorPanel field={field} isReadOnly={isReadOnly} onChangeRef={onChangeRef} />;
    }

    return (
        <TextAreaForm
            value={field.state.value}
            readOnly={isReadOnly}
            onChange={(value) => {
                onChangeRef();
                field.handleChange(value);
            }}
            className="tool-code-mirror h-full flex-1"
            autoFocus
        />
    );
};

export default CodeManagerEditor;
