import { useState } from 'react';

import { fileIconFor, isImageByExt, normalizeExt } from './file-list-utils';

interface FileThumbProps {
    thumbnailUrl?: string;
    extension?: string;
    fileName?: string;
    isImage?: boolean;
}

const FileThumb = ({ thumbnailUrl, extension, fileName, isImage }: FileThumbProps) => {
    const [errored, setErrored] = useState(false);
    const ext = normalizeExt(extension ?? fileName?.split('.').pop());
    const showImage = (isImage ?? isImageByExt(ext)) && thumbnailUrl && !errored;

    if (showImage) {
        return (
            <img
                src={thumbnailUrl}
                alt=""
                loading="lazy"
                onError={() => setErrored(true)}
                className="size-9 shrink-0 rounded-lg object-cover"
            />
        );
    }

    const Icon = fileIconFor(ext);

    return (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
        </span>
    );
};

export default FileThumb;
