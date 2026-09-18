import { useMemo } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';

import FieldHelp from '../primitives/field-help';

interface Props {
    label: string;
    description?: string;
    value: unknown;
    onChange: (next: unknown) => void;
    readOnly?: boolean;
}

const JsonSnippetEditor = ({ label, description, value, onChange, readOnly }: Props) => {
    const content = useMemo<Content>(() => ({ json: value ?? {} }), [value]);

    return (
        <div className="flex flex-col gap-1.5">
            <FieldHelp label={label} description={description} />
            <div className="json-snippet-editor rounded-md border">
                <JSONEditor
                    isErrored={false}
                    content={content}
                    readOnly={readOnly}
                    onChange={(next: Content) => {
                        if ('json' in next && next.json !== undefined) {
                            onChange(next.json);

                            return;
                        }
                        if ('text' in next && typeof next.text === 'string') {
                            try {
                                onChange(JSON.parse(next.text));
                            } catch {
                                // Ignore parse errors; value stays until user fixes syntax.
                            }
                        }
                    }}
                />
            </div>
        </div>
    );
};

export default JsonSnippetEditor;
