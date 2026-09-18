import React, { useCallback, useRef } from 'react';

import { InstructionsEditor } from '@/components/instructions-editor';

import { splitFrontmatter } from '../utils';

type FrontmatterSafeEditorProps = Omit<React.ComponentProps<typeof InstructionsEditor>, 'value' | 'onChange'> & {
    value: string;
    onChange: (value: string) => void;
};

/**
 * Wraps the WYSIWYG InstructionsEditor for editing markdown files that may carry YAML frontmatter.
 * TipTap's markdown round-trip mangles frontmatter (`---` becomes a thematic break / setext heading),
 * so we edit only the body in the editor and re-attach the untouched frontmatter on every change.
 * The frontmatter and onChange are read through refs because the editor freezes its onUpdate closure
 * on first render.
 */
export const FrontmatterSafeEditor = ({ value, onChange, ...rest }: FrontmatterSafeEditorProps) => {
    const { frontmatter, body } = splitFrontmatter(value);

    const frontmatterRef = useRef(frontmatter);
    const onChangeRef = useRef(onChange);

    frontmatterRef.current = frontmatter;
    onChangeRef.current = onChange;

    const handleBodyChange = useCallback((newBody: string) => {
        onChangeRef.current(frontmatterRef.current + newBody);
    }, []);

    return <InstructionsEditor value={body} onChange={handleBodyChange} {...rest} />;
};
