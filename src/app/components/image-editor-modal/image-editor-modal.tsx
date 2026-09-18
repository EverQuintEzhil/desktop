import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import Spinner from '@/components/ui/spinner';
import { shouldEscapeKeepDialogOpen } from '@/utils/escape-cancels-edit';

import { ImageEditor } from './components';
import { useSafeImageUrl } from './hooks';
import './image-editor-modal.scss';
import type { ImageEditorModalProps } from './types';

const ImageEditorModal = (props: ImageEditorModalProps) => {
    const { imageUrl, imageName, isOpen, onClose } = props;
    const { safeImageUrl, loading } = useSafeImageUrl(imageUrl);

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-4">
                    <Spinner className="scale-150" />
                    <span className="text-sm">Loading</span>
                </div>
            );
        }

        return <ImageEditor safeImageUrl={safeImageUrl} imageName={imageName} onModalClose={onClose} />;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                id="image-editor-modal"
                className="max-w-[1400px] overflow-visible border-none bg-transparent shadow-none max-lg:max-h-screen"
                onEscapeKeyDown={(event) => {
                    if (shouldEscapeKeepDialogOpen(event)) {
                        event.preventDefault();
                    }
                }}
                onInteractOutside={(event) => {
                    const target = event.target as HTMLElement | null;

                    if (target?.closest('[data-sonner-toaster]')) {
                        event.preventDefault();
                    }
                }}
            >
                <DialogTitle className="sr-only">Image Editor</DialogTitle>
                <div className="image-editor-modal h-[80vh] min-h-[520px] w-full overflow-hidden transition-none max-lg:h-svh max-lg:rounded-none">
                    {renderContent()}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ImageEditorModal;
