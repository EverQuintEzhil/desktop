import { useEffect, useRef, useState } from 'react';

export const useSourceImage = (imageUrl: string) => {
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        if (!imageUrl) {
            imageRef.current = null;
            setVersion((v) => v + 1);

            return;
        }

        const img = new Image();

        img.crossOrigin = 'anonymous';

        img.onload = () => {
            imageRef.current = img;
            setVersion((v) => v + 1);
        };

        img.onerror = () => {
            imageRef.current = null;
            setVersion((v) => v + 1);
        };

        img.src = imageUrl;

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [imageUrl]);

    return { imageRef, version };
};
