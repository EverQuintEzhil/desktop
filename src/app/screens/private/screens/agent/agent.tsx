import type { AxiosError } from 'axios';
import { BadgeAlertIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import AnnouncementsModal from '@/app/components/announcements-modal';
import { useAnnouncements } from '@/app/hooks/use-announcements';
import Spinner from '@/components/ui/spinner';
import { copyModelParameters } from '@/lib/copy-model-parameters';
import type { AgentType } from '@/types/admin';
import { hasApiUi, hasAppUi, hasChatUi, hasGalleryUi } from '@/types/ui';

import './agent.scss';
import { showErrorToast } from '@/utils';

import { APIAgent, GalleryAgent } from './components';
import AppAgent from './components/app-agent';
import ChatAgentNew from './components/chat-agent';
import { useAgentQuery } from './hooks/use-agent-query';

const Agent = () => {
    const params = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const { data: rawAgent, isLoading, isError, error } = useAgentQuery(params.agentId);

    useEffect(() => {
        if (!isError || !error) return;

        const axiosError = error as AxiosError;

        if (axiosError.response?.status === 404) {
            showErrorToast('This agent is not available.');
            navigate('/');
        }
    }, [isError, error, navigate]);

    const agent = useMemo<AgentType | undefined>(() => {
        if (!rawAgent) return rawAgent;
        if (!rawAgent.models?.length) return rawAgent;

        const uiConfig = rawAgent.uiConfig;

        if (!uiConfig || !('models' in uiConfig) || !Array.isArray(uiConfig.models)) return rawAgent;

        const enrichedModels = uiConfig.models.map((uiModel) => {
            const sourceModel = rawAgent.models!.find((m) => m._id === uiModel.modelId);

            if (!sourceModel) return uiModel;

            const derived = copyModelParameters(sourceModel.parameters);

            if (!derived) return uiModel;

            return {
                ...uiModel,
                parameters: { ...derived, ...(uiModel.parameters ?? {}) },
            };
        });

        return {
            ...rawAgent,
            uiConfig: { ...uiConfig, models: enrichedModels },
        } as AgentType;
    }, [rawAgent]);

    const { announcementsState, hideWhatsNew, fetchAnnouncements, closeAnnouncementsModal, markAnnouncementsAsRead } =
        useAnnouncements();

    useEffect(() => {
        fetchAnnouncements(params.agentId);
    }, [params.agentId, hideWhatsNew]);

    if (isLoading) {
        return (
            <div className="viewport-height flex flex-col items-center justify-center gap-6 p-4">
                <Spinner className="scale-150" />
                <h2 className="text-center font-medium">Loading</h2>
            </div>
        );
    }

    const renderAnnouncementsModal = () => {
        const isAgentPage = location.pathname === '/' || location.pathname.startsWith('/agent/');

        if (!isAgentPage) {
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

    if (agent && hasApiUi(agent)) {
        return (
            <div className="page page-styled relative flex min-h-svh w-full bg-background max-lg:flex-col">
                <APIAgent agent={agent} key={agent._id} />
                {renderAnnouncementsModal()}
            </div>
        );
    }
    if (agent && hasGalleryUi(agent)) {
        return (
            <div className="page page-styled relative flex min-h-svh w-full bg-background max-lg:flex-col">
                <GalleryAgent agent={agent} key={agent._id} />
                {renderAnnouncementsModal()}
            </div>
        );
    }

    if (agent && hasAppUi(agent)) {
        return (
            <div className="page page-styled relative flex h-svh w-full overflow-hidden bg-background max-lg:flex-col">
                <AppAgent agent={agent} key={agent._id} />
                {renderAnnouncementsModal()}
            </div>
        );
    }

    if (agent && hasChatUi(agent)) {
        return (
            <div className="page page-styled relative flex min-h-svh w-full bg-background max-lg:flex-col">
                <ChatAgentNew agent={agent} key={agent._id} />
                {renderAnnouncementsModal()}
            </div>
        );
    }

    if (agent) {
        return (
            <div className="page page-styled relative flex min-h-svh w-full bg-background max-lg:flex-col">
                <div className="viewport-height m-auto flex flex-col items-center justify-center gap-6 p-4 text-center">
                    <BadgeAlertIcon className="size-16 text-destructive" />
                    <div className="flex max-w-sm flex-col items-center justify-center gap-2">
                        <h2 className="text-lg font-medium">Agent UI configuration is unavailable</h2>
                        <span className="leading-[20px] text-text-secondary">
                            This agent does not have a supported UI configuration yet.
                        </span>
                    </div>
                </div>
                {renderAnnouncementsModal()}
            </div>
        );
    }

    return null;
};

export default Agent;
