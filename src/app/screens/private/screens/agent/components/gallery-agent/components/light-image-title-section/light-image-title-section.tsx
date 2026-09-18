import { useState, useRef, useEffect } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import TitleModal from '../title-modal';

interface PropsType {
    title: string;
    isRemixAvailable?: boolean;
    onTitleModalOpenChange?: (isOpen: boolean) => void;
}

const LightImageTitleSection = (props: PropsType) => {
    const { title, isRemixAvailable, onTitleModalOpenChange } = props;

    const [titleModalImage, setTitleModalImage] = useState(false);
    const [tooltipOpen, setTooltipOpen] = useState(false);
    const titleRef = useRef<HTMLSpanElement>(null);

    const handleMouseEnter = () => {
        if (titleRef.current && titleRef.current.scrollWidth > titleRef.current.clientWidth) {
            setTooltipOpen(true);
        }
    };

    useEffect(() => {
        onTitleModalOpenChange?.(titleModalImage);

        return () => onTitleModalOpenChange?.(false);
    }, [onTitleModalOpenChange, titleModalImage]);

    return (
        <div className="w-full" onClick={(e) => e.stopPropagation()}>
            <div
                className={`lightbox-message mx-auto w-full max-lg:px-4 max-sm:mt-4 ${isRemixAvailable ? 'image-title pb-2' : 'video-title pb-2'}`}
            >
                <TooltipProvider>
                    <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
                        <TooltipTrigger asChild>
                            <span
                                ref={titleRef}
                                className="title-text"
                                role="button"
                                tabIndex={0}
                                onMouseEnter={handleMouseEnter}
                                onClick={() => setTitleModalImage(true)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setTitleModalImage(true);
                                    }
                                }}
                            >
                                {title}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent
                            className="max-w-lg border border-white/15 bg-[#1f1f1f] px-3 py-2 text-left wrap-break-word text-white shadow-xl"
                            arrowClassName="fill-[#1f1f1f]"
                        >
                            <div className="line-clamp-20 max-h-[50vh] overflow-hidden">{title}</div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            <TitleModal isOpen={titleModalImage} title={title} onClose={() => setTitleModalImage(false)} />
        </div>
    );
};

export default LightImageTitleSection;
