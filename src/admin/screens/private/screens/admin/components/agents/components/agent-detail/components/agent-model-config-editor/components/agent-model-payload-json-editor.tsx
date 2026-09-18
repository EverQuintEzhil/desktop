import { useEffect, useRef } from 'react';
import {
    type Content,
    type JSONEditorPropsOptional,
    type OnChangeStatus,
    JsonEditor,
    createJSONEditor,
    isJSONContent,
    isTextContent,
} from 'vanilla-jsoneditor';

import '@/components/json-editor/json-editor.scss';
import { cn } from '@/lib/utils';

const tryParseContentJson = (content: Content): unknown | undefined => {
    try {
        if (isTextContent(content) && content.text) {
            return JSON.parse(content.text);
        }
        if (isJSONContent(content) && content.json !== undefined) {
            return content.json;
        }
    } catch {
        return undefined;
    }

    return undefined;
};

const stableJsonSnapshot = (value: unknown): string => JSON.stringify(value);

const serializeContentForDeps = (content: Content | undefined): string => {
    if (!content) {
        return '';
    }
    if (isTextContent(content)) {
        return `t:${content.text}`;
    }
    if (isJSONContent(content)) {
        return `j:${JSON.stringify(content.json)}`;
    }

    return '';
};

type Props = {
    payload: Record<string, unknown>;
    readOnly: boolean;
    onChange: (content: Content, previousContent: Content, status: OnChangeStatus) => void;
    className?: string;
    containerClassName?: string;
};

/**
 * Per-model JSON editor for agent model config form only.
 * The shared JSONEditor calls updateProps on every render ([props]), which retriggers
 * all embedded editors and can throw CodeMirror "Selection points outside of document".
 * This host only updates when serialized content or readOnly changes.
 */
const AgentModelPayloadJsonEditor = ({ payload, readOnly, onChange, className, containerClassName }: Props) => {
    const refContainer = useRef<HTMLDivElement>(null);
    const refEditor = useRef<JsonEditor | null>(null);
    const onChangeRef = useRef(onChange);
    const payloadRef = useRef(payload);

    onChangeRef.current = onChange;
    payloadRef.current = payload;

    const contentDep = serializeContentForDeps({ json: payload });

    useEffect(() => {
        refEditor.current = createJSONEditor({
            target: refContainer.current as HTMLElement,
            props: {
                content: { json: payloadRef.current },
                mode: 'text',
                mainMenuBar: false,
                statusBar: false,
                readOnly,
                onChange: (next: Content, previousContent: Content, status: OnChangeStatus) => {
                    onChangeRef.current(next, previousContent, status);
                },
            },
        });

        return () => {
            if (refEditor.current) {
                refEditor.current.destroy();
                refEditor.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!refEditor.current) {
            return;
        }

        const editor = refEditor.current;
        const incoming = payloadRef.current;

        let editorMatchesIncoming = false;

        try {
            const current = editor.get();
            const currentJson = tryParseContentJson(current);

            if (currentJson !== undefined) {
                editorMatchesIncoming = stableJsonSnapshot(currentJson) === stableJsonSnapshot(incoming);
            }
        } catch {
            editorMatchesIncoming = false;
        }

        const baseProps = {
            mode: 'text' as const,
            mainMenuBar: false,
            statusBar: false,
            readOnly,
            onChange: (next: Content, previousContent: Content, status: OnChangeStatus) => {
                onChangeRef.current(next, previousContent, status);
            },
        };

        if (editorMatchesIncoming) {
            editor.updateProps(baseProps as JSONEditorPropsOptional);

            return;
        }

        editor.updateProps({
            ...baseProps,
            content: { json: incoming },
        } as JSONEditorPropsOptional);
    }, [contentDep, readOnly]);

    return (
        <div className={cn('json-editor flex h-full', containerClassName)}>
            <div ref={refContainer} className={cn('vanilla-json-editor', className)}></div>
        </div>
    );
};

export default AgentModelPayloadJsonEditor;
