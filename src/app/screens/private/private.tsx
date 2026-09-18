import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AnnouncementsModal from '@/app/components/announcements-modal';
import { useAnnouncements } from '@/app/hooks/use-announcements';
import { HELP_CENTER_PATH } from '@/app/screens/private/screens/blogs/constants';
import SampleDesigns from '@/app/screens/private/screens/sample-designs/sample-designs';
import AppearancePanel from '@/components/avatar-menu/settings/appearance-panel';
import GeneralPanel from '@/components/avatar-menu/settings/general-panel';
import LoginActivitiesPanel from '@/components/avatar-menu/settings/login-activities-panel';
import NotificationsPanel from '@/components/avatar-menu/settings/notifications-panel';
import ErrorBoundary from '@/components/error-boundary';
import ShortcutsPanel from '@/components/keyboard-shortcuts/shortcuts-panel';
import { useAppSelector, useDeepLinkRedirect } from '@/hooks';
import Logout from '@/screens/logout';
import { selectHideCreateAgent, selectHideRoutines, selectHideWhatsNew } from '@/store/selectors';

import {
    Agent,
    Agents,
    ArtifactPage,
    Blogs,
    Blog,
    BlogAllPosts,
    BlogCollections,
    BlogCollectionDetail,
    CreateAgent,
    CreateAgentEditor,
    Connectors,
    SettingsLayout,
    Skills,
    LibraryPage,
    GlobalLibrary,
    Memories,
    Routines,
    RoutineDetail,
} from './screens';

const Private = () => {
    const location = useLocation();
    const hideWhatsNewForMe = useAppSelector(selectHideWhatsNew);
    const hideCreateAgentForMe = useAppSelector(selectHideCreateAgent);
    const whatsNewElement = hideWhatsNewForMe ? <Navigate to="/" replace /> : <Blogs />;
    const hideRoutinesForMe = useAppSelector(selectHideRoutines);

    useDeepLinkRedirect({ fallbackPath: '/' });

    const { announcementsState, hideWhatsNew, fetchAnnouncements, closeAnnouncementsModal, markAnnouncementsAsRead } =
        useAnnouncements();

    // `/agent/*` fetches and renders its own announcements in agent.tsx; every other route has
    // nowhere to show the result.
    useEffect(() => {
        if (location.pathname === '/') {
            fetchAnnouncements();
        }
    }, [hideWhatsNew, location.pathname]);

    const renderAnnouncementsModal = () => {
        if (location.pathname !== '/') {
            return null;
        }

        return (
            <AnnouncementsModal
                isOpen={announcementsState.isModalOpen}
                announcements={announcementsState.announcements}
                onClose={closeAnnouncementsModal}
                onMarkAsRead={markAnnouncementsAsRead}
            />
        );
    };

    return (
        <>
            <ErrorBoundary>
                <Routes>
                    <Route path="" element={<Agents />} />
                    <Route path="agent/:agentId/*" element={<Agent />} />
                    <Route path="agent/:agentId/artifact/:artifactId" element={<ArtifactPage />} />
                    <Route path="announcements" element={whatsNewElement}>
                        <Route index element={<BlogAllPosts />} />
                        <Route path=":blogPostId" element={<Blog />} />
                    </Route>
                    <Route path="help-center" element={whatsNewElement}>
                        <Route index element={<BlogCollections />} />
                        <Route path="collections" element={<Navigate to={HELP_CENTER_PATH} replace />} />
                        <Route path="collections/:categoryId" element={<BlogCollectionDetail />} />
                        <Route path=":blogPostId" element={<Blog />} />
                    </Route>
                    <Route path="sample-designs" element={<SampleDesigns />} />
                    <Route path="library" element={<LibraryPage />} />
                    <Route
                        path="agent-builder"
                        element={hideCreateAgentForMe ? <Navigate to="/" replace /> : <CreateAgent />}
                    />
                    <Route path="settings" element={<SettingsLayout />}>
                        <Route index element={<Navigate to="/settings/connectors" replace />} />
                        <Route path="appearance" element={<AppearancePanel />} />
                        <Route path="user" element={<GeneralPanel />} />
                        <Route path="connectors" element={<Connectors />} />
                        <Route path="connectors/:connectorId" element={<Connectors />} />
                        <Route path="skills" element={<Skills />} />
                        <Route path="skills/:skillId" element={<Skills />} />
                        <Route path="memories" element={<Memories />} />
                        <Route path="memories/:memoryId" element={<Memories />} />
                        <Route
                            path="routines"
                            element={hideRoutinesForMe ? <Navigate to="/" replace /> : <Routines />}
                        />
                        {/* Settings lists routines even for agents whose own /agent/<slug>/routines route is off. */}
                        <Route
                            path="routines/:routineId"
                            element={hideRoutinesForMe ? <Navigate to="/" replace /> : <RoutineDetail />}
                        />
                        <Route
                            path="library"
                            element={
                                <GlobalLibrary
                                    basePath="/settings/library"
                                    contentClassName="flex flex-col w-full relative h-full min-h-0 max-lg:pt-[50px]"
                                    scrollMode="container"
                                />
                            }
                        />
                        <Route path="login-activities" element={<LoginActivitiesPanel />} />
                        <Route path="notifications" element={<NotificationsPanel />} />
                        <Route path="keyboard-shortcuts" element={<ShortcutsPanel showHeading />} />
                    </Route>

                    <Route path="agent-builder/:id/*" element={<CreateAgentEditor />} />
                    <Route path="/logout" element={<Logout />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </ErrorBoundary>
            {renderAnnouncementsModal()}
        </>
    );
};

export default Private;
