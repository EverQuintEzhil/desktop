export const removeMermaidTemporaryRenderNode = (diagramId: string) => {
    document.getElementById(`d${diagramId}`)?.remove();
};
