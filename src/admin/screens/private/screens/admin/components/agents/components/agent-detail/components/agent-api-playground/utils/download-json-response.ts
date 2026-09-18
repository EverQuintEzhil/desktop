/** Triggers a browser download of the response payload as a timestamped JSON file. */
const downloadJsonResponse = (response: Record<string, unknown>): void => {
    const dataStr = JSON.stringify(response, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `api-response-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    const linkElement = document.createElement('a');

    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
};

export default downloadJsonResponse;
