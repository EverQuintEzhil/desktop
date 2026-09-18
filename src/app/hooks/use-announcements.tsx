import { isCancel } from 'axios';
import { useEffect, useRef, useState } from 'react';

import { useAppSelector } from '@/hooks';
import { appAnnouncementsApi } from '@/lib/api/app/announcements';
import { selectHideWhatsNew } from '@/store/selectors';
import type { BlogPostType } from '@/types/admin';

type AnnouncementsState = {
    loading: boolean;
    announcements: BlogPostType[];
    isModalOpen: boolean;
};

export const useAnnouncements = () => {
    const hideWhatsNew = useAppSelector(selectHideWhatsNew);
    const [announcementsState, setAnnouncementsState] = useState<AnnouncementsState>({
        loading: false,
        announcements: [],
        isModalOpen: false,
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(
        () => () => {
            abortControllerRef.current?.abort();
        },
        [],
    );

    const fetchAnnouncements = async (agentId?: string | null) => {
        abortControllerRef.current?.abort();

        if (hideWhatsNew) return;

        const controller = new AbortController();

        abortControllerRef.current = controller;

        try {
            setAnnouncementsState((prev) => ({ ...prev, loading: true }));

            const result = await appAnnouncementsApi.listAnnouncements<BlogPostType>(
                {
                    size: 100,
                    page: 0,
                    types: 'announcement',
                    unreadOnly: true,
                    agentId: agentId ? agentId : 'null',
                },
                { signal: controller.signal },
            );

            const announcements = result.values.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

            if (announcements.length > 0) {
                setAnnouncementsState({
                    loading: false,
                    announcements,
                    isModalOpen: true,
                });
            } else {
                setAnnouncementsState({
                    loading: false,
                    announcements: [],
                    isModalOpen: false,
                });
            }
        } catch (error) {
            // A superseded request rejects here; writing state would undo the newer request's result.
            if (isCancel(error)) return;

            console.error('Error fetching announcements:', error);
            setAnnouncementsState({
                loading: false,
                announcements: [],
                isModalOpen: false,
            });
        }
    };

    const closeAnnouncementsModal = () => {
        setAnnouncementsState((prev) => ({ ...prev, isModalOpen: false }));
    };

    const markAnnouncementsAsRead = async () => {
        const blogPostIds = announcementsState.announcements.map((a) => a._id);

        if (blogPostIds.length === 0) return;

        try {
            await appAnnouncementsApi.markRead({ blogPostIds });
            closeAnnouncementsModal();
        } catch (error) {
            console.error('Error marking announcements as read:', error);
            throw error;
        }
    };

    // The flag can flip while a request is already in flight.
    const gatedState = hideWhatsNew ? { loading: false, announcements: [], isModalOpen: false } : announcementsState;

    return {
        announcementsState: gatedState,
        hideWhatsNew,
        fetchAnnouncements,
        closeAnnouncementsModal,
        markAnnouncementsAsRead,
    };
};
