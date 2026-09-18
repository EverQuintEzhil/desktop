import type { CropBox, ImageDimensions } from '../../utils/crop-utils';
import '../crop-overlay/crop-overlay.scss';

interface FitOverlayProps {
    crop: CropBox;
    imageDimensions: ImageDimensions;
    displaySize: { width: number; height: number };
}

const FitOverlay = (props: FitOverlayProps) => {
    const { crop, imageDimensions, displaySize } = props;
    const scaleX = displaySize.width / imageDimensions.width;
    const scaleY = displaySize.height / imageDimensions.height;

    const displayCrop = {
        x: crop.x * scaleX,
        y: crop.y * scaleY,
        width: crop.width * scaleX,
        height: crop.height * scaleY,
    };

    return (
        <div
            className="crop-overlay-container"
            style={{
                width: `${displaySize.width}px`,
                height: `${displaySize.height}px`,
            }}
        >
            <div
                className="crop-box cursor-default"
                style={{
                    left: `${displayCrop.x}px`,
                    top: `${displayCrop.y}px`,
                    width: `${displayCrop.width}px`,
                    height: `${displayCrop.height}px`,
                }}
            >
                <div className="crop-grid" />
            </div>
        </div>
    );
};

export default FitOverlay;
