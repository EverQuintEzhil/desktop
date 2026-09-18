import { useMemo } from 'react';

import WebLinksInlineEditor from '@/admin/screens/private/screens/admin/components/data-stores/components/data-stores-detail/components/data-stores-web-links/web-links-inline-editor';
import {
    parseWeblinksLinks,
    type WeblinkAuthSecretEntry,
} from '@/admin/screens/private/screens/admin/components/data-stores/components/wizard-pages/configure-weblinks-step/weblinks-validation';
import {
    useWizardSaveConnectionMutation,
    useWizardSaveWeblinksMutation,
    type WeblinkSpec,
} from '@/lib/api/admin/data-stores';
import type { DataStoreType } from '@/types/admin';
import { showSuccessToast } from '@/utils';

interface WeblinksCardProps {
    dataStore: DataStoreType;
    onSaved: (linkCount: number) => void;
    onSkip: () => void;
}

/** The weblinks provider has no connection: its setup form is the list of links to crawl or scrape. */
const WeblinksCard = ({ dataStore, onSaved, onSkip }: WeblinksCardProps) => {
    const saveWeblinksMutation = useWizardSaveWeblinksMutation();
    const saveConnectionMutation = useWizardSaveConnectionMutation();
    const links = useMemo(() => parseWeblinksLinks(dataStore.specification), [dataStore.specification]);
    // The editor freezes its rows at mount, but this card stays mounted while the same store can be
    // saved from the data store page. Keying on the saved specification re-seeds the editor whenever
    // the stored links change, so a stale card save cannot overwrite links added elsewhere.
    const seedKey =
        typeof dataStore.specification === 'string'
            ? dataStore.specification
            : JSON.stringify(dataStore.specification ?? null);

    const handleSave = async (
        nextLinks: WeblinkSpec[],
        authPayload: { auth: Record<string, WeblinkAuthSecretEntry> } | null,
    ) => {
        await saveWeblinksMutation.mutateAsync({
            id: dataStore._id,
            data: { links: nextLinks },
        });

        if (authPayload) {
            try {
                await saveConnectionMutation.mutateAsync({ id: dataStore._id, data: authPayload });
            } catch (error: unknown) {
                console.error(error);

                // The links PUT above already succeeded; rethrow through the editor's error surface
                // so the message reflects the partial save. Saving again retries both.
                throw Object.assign(new Error('weblinks credentials save failed'), {
                    response: {
                        data: {
                            message:
                                'The links were saved, but the credentials could not be stored. Save again to retry.',
                        },
                    },
                });
            }
        }

        showSuccessToast('Web links saved successfully.');
        onSaved(nextLinks.length);
    };

    return (
        <WebLinksInlineEditor
            key={seedKey}
            initialLinks={links}
            isSaving={saveWeblinksMutation.isPending || saveConnectionMutation.isPending}
            onCancel={onSkip}
            onSave={handleSave}
        />
    );
};

export default WeblinksCard;
export { WeblinksCard };
