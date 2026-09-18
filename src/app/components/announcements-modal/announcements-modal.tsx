import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { ANNOUNCEMENTS_PATH } from '@/app/screens/private/screens/blogs/constants';
import Image from '@/components/image';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { BlogPostType } from '@/types/admin';
import { showErrorToast } from '@/utils';

import './announcements-modal.scss';

interface AnnouncementsModalProps {
    isOpen: boolean;
    announcements: BlogPostType[];
    onClose: () => void;
    onMarkAsRead: () => Promise<void>;
}

const AnnouncementsModal: React.FC<AnnouncementsModalProps> = ({ isOpen, announcements, onClose, onMarkAsRead }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dontShowAgain, setDontShowAgain] = useState(true);

    const handlePrevious = useCallback(() => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
    }, []);

    const handleNext = useCallback(() => {
        setCurrentIndex((prev) => (prev < announcements.length - 1 ? prev + 1 : prev));
    }, [announcements.length]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (!isOpen) return;

            if (event.key === 'ArrowLeft') {
                handlePrevious();
            } else if (event.key === 'ArrowRight') {
                handleNext();
            }
        },
        [isOpen, handlePrevious, handleNext],
    );

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    useEffect(() => {
        setCurrentIndex(0);
    }, [announcements]);

    if (announcements.length === 0) {
        return null;
    }

    const currentAnnouncement = announcements[currentIndex];
    const hasFeaturedImage = currentAnnouncement?.featuredImage;
    const imageUrl =
        typeof currentAnnouncement?.featuredImage === 'string'
            ? currentAnnouncement.featuredImage
            : currentAnnouncement?.featuredImage?.url;

    const handleAnnouncementClick = () => {
        if (currentAnnouncement?.slug) {
            window.open(`${ANNOUNCEMENTS_PATH}/${currentAnnouncement.slug}`, '_blank', 'noopener,noreferrer');
        }
    };

    const handleClose = async () => {
        if (dontShowAgain) {
            try {
                await onMarkAsRead();
            } catch {
                showErrorToast('Failed to save preference. Please try again.');
                onClose();
            }
        } else {
            onClose();
        }
    };

    const handleGotIt = async () => {
        if (dontShowAgain) {
            try {
                await onMarkAsRead();
            } catch {
                showErrorToast('Failed to save preference. Please try again.');
                onClose();
            }
        } else {
            onClose();
        }
    };

    const handleDontShowAgainChange = (_value: string | number | readonly string[] | undefined, checked: boolean) => {
        setDontShowAgain(checked);
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            void handleClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="h-[555px] w-full max-w-[640px] gap-0 overflow-hidden rounded-xl p-0 max-sm:h-[415px]">
                <DialogTitle className="sr-only">{currentAnnouncement?.title || 'Announcement'}</DialogTitle>
                <DialogDescription className="sr-only">
                    {currentAnnouncement?.description || 'Review the latest announcement.'}
                </DialogDescription>
                <Button
                    className="absolute top-3 right-3 z-1 h-8 min-w-8 justify-center rounded-full p-0"
                    aria-label="Close announcements"
                    onClick={handleClose}
                    variant="secondary"
                >
                    <XIcon />
                </Button>
                <div className="relative flex h-full w-full flex-col">
                    {announcements.length > 1 && (
                        <>
                            <Button
                                className="absolute top-1/2 left-3 z-1 min-w-8 -translate-y-1/2 justify-center rounded-full p-0 max-sm:left-2"
                                variant="secondary"
                                size="icon-sm"
                                onClick={handlePrevious}
                                disabled={currentIndex === 0}
                            >
                                <ChevronLeftIcon />
                            </Button>
                            <Button
                                className="absolute top-1/2 right-3 z-1 min-w-8 -translate-y-1/2 justify-center rounded-full p-0 max-sm:right-2"
                                variant="secondary"
                                size="icon-sm"
                                onClick={handleNext}
                                disabled={currentIndex === announcements.length - 1}
                            >
                                <ChevronRightIcon />
                            </Button>
                        </>
                    )}

                    <div className="flex flex-1 flex-col overflow-hidden">
                        <div
                            className={cn(
                                'accouncement-slide-container flex h-full w-full flex-col',
                                currentAnnouncement?.slug ? 'cursor-pointer' : 'cursor-default',
                            )}
                            onClick={handleAnnouncementClick}
                        >
                            {hasFeaturedImage && imageUrl ? (
                                <div className="flex h-fit w-full items-center justify-center overflow-hidden bg-background">
                                    <Image
                                        src={imageUrl}
                                        alt={currentAnnouncement?.title || 'Announcement'}
                                        placeholder="/assets/images/broken-image.svg"
                                    />
                                </div>
                            ) : null}

                            <div className="scrollbar-controller scrollbar-vertical flex flex-col gap-1 px-4 pt-4">
                                {currentAnnouncement?.title && (
                                    <h2 className="text-2xl font-bold">{currentAnnouncement.title}</h2>
                                )}
                                {currentAnnouncement?.description && (
                                    <div className="announcement-content line-clamp-2">
                                        <span>{currentAnnouncement.description}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {announcements.length > 1 && (
                        <div className="accouncement-dots-container flex items-center justify-center gap-2 bg-card p-4">
                            {announcements.map((announcement, index) => (
                                <button
                                    key={announcement._id}
                                    className={`accouncement-dot ${index === currentIndex ? 'is-active' : ''}`}
                                    onClick={() => setCurrentIndex(index)}
                                />
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between border-t border-border-secondary bg-card px-4 py-3">
                        <Checkbox
                            label="Don't show this again"
                            checked={dontShowAgain}
                            onChange={handleDontShowAgainChange}
                        />
                        <Button
                            size="sm"
                            className="min-w-[54px] justify-center rounded-full text-base font-normal"
                            onClick={handleGotIt}
                        >
                            OK
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default AnnouncementsModal;
