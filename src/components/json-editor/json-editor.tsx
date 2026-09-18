import { useEffect, useRef } from 'react';
import { type JSONEditorPropsOptional, JsonEditor, createJSONEditor } from 'vanilla-jsoneditor';

import './json-editor.scss';
import { cn } from '@/lib/utils';

interface JSONEditorProps extends Omit<JSONEditorPropsOptional, 'mode'> {
    mode?: 'text' | 'tree';
    isErrored?: boolean;
    className?: string;
    containerClassName?: string;
}

const JSONEditor = (props: JSONEditorProps) => {
    const { isErrored, className, containerClassName, ...rest } = props;
    const refContainer = useRef<HTMLDivElement>(null);
    const refEditor = useRef<JsonEditor>(null);

    useEffect(() => {
        refEditor.current = createJSONEditor({
            target: refContainer.current as HTMLElement,
            props: {
                mode: 'text',
                mainMenuBar: true,
                statusBar: false,
                ...rest,
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
        if (refEditor.current) {
            refEditor.current.updateProps(props as JSONEditorPropsOptional);
        }
    }, [props]);

    return (
        <div className={cn('json-editor flex h-full', isErrored ? 'has-error' : '', containerClassName)}>
            <div ref={refContainer} className={cn('vanilla-json-editor', className)}></div>
        </div>
    );
};

export default JSONEditor;
