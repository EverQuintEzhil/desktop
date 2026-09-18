import { Route, Routes } from 'react-router-dom';

import { UploadFilesProvider } from '@/context';
import type { GalleryAgentType } from '@/types/admin';

import { GalleryGeneration, VideoGeneration } from './components';
import { GalleryFileView } from './components/gallery-file-view';
import { UserGalleryView } from './components/user-gallery-view';
import './shared/lightbox-shared.scss';

interface Props {
    agent: GalleryAgentType;
    isFromAdmin?: boolean;
}

const GalleryAgent = (props: Props) => {
    const { agent, isFromAdmin } = props;
    const isVideo = agent.uiConfig.type === 'video';

    return (
        <UploadFilesProvider>
            <Routes>
                <Route path="user/:userId" element={<UserGalleryView agent={agent} isVideo={isVideo} />} />
                <Route path=":fileId" element={<GalleryFileView agent={agent} isVideo={isVideo} />} />
                <Route
                    path=""
                    element={
                        isVideo ? (
                            <VideoGeneration agent={agent} isFromAdmin={isFromAdmin} />
                        ) : (
                            <GalleryGeneration agent={agent} isFromAdmin={isFromAdmin} />
                        )
                    }
                />
            </Routes>
        </UploadFilesProvider>
    );
};

export default GalleryAgent;
