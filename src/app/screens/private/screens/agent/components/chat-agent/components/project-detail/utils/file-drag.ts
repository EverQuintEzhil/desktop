// Ignore non-file drags (text/links) so the composer overlay only appears for real files.
export const isFileDrag = (event: React.DragEvent): boolean =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files');

// Rebuild a FileList from screened files so it can be handed to the composer's onChangeFile.
export const toFileList = (files: File[]): FileList => {
    const dataTransfer = new DataTransfer();

    files.forEach((file) => dataTransfer.items.add(file));

    return dataTransfer.files;
};
