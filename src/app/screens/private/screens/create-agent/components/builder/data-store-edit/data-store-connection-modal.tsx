import { XIcon } from 'lucide-react';

import DataStoresConnection from '@/admin/screens/private/screens/admin/components/data-stores/components/data-stores-detail/components/data-stores-connection/data-stores-connection';
import { panelBtnCls } from '@/app/components/picker/picker-shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { DataStoreType, ProviderType } from '@/types/admin';

const PROVIDERS_WITHOUT_CONNECTION: ProviderType[] = ['files', 'weblinks'];

export const dataStoreHasEditableConnection = (provider: ProviderType | undefined): boolean =>
    !!provider && !PROVIDERS_WITHOUT_CONNECTION.includes(provider);

interface DataStoreConnectionModalProps {
    dataStore: DataStoreType;
    isOpen: boolean;
    onClose: () => void;
    /** Fires only when the connection was saved, unlike onClose which also covers dismissal. */
    onSaved?: () => void;
}

export const DataStoreConnectionModal = ({ dataStore, isOpen, onClose, onSaved }: DataStoreConnectionModalProps) => (
    <Dialog
        open={isOpen}
        onOpenChange={(next) => {
            if (!next) onClose();
        }}
    >
        <DialogContent className="gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-[560px]">
            <DialogHeader className="flex-row items-start justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 flex-col gap-1">
                    <DialogTitle className="text-lg font-medium tracking-[-0.03em] text-(--text-primary)">
                        Edit connection
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Credentials are stored encrypted, so they are never sent back to the browser — re-enter the full
                        connection to save it.
                    </DialogDescription>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close"
                    onClick={onClose}
                    className={`-mr-1.5 shrink-0 ${panelBtnCls}`}
                >
                    <XIcon size={17} aria-hidden="true" />
                </Button>
            </DialogHeader>

            <div className="px-5 py-5">
                <DataStoresConnection
                    dataStore={dataStore}
                    canUserEdit
                    showConnectionSecrets={false}
                    onSubmit={() => {
                        onSaved?.();
                        onClose();
                    }}
                />
            </div>
        </DialogContent>
    </Dialog>
);
