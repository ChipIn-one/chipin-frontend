import {
    type ImgHTMLAttributes,
    type ReactEventHandler,
    useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Skeleton } from '@radix-ui/themes';

type ImageStatus = 'loading' | 'loaded' | 'error';

interface ImageState {
    src?: string;
    status: ImageStatus;
}

interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
    width?: string;
    height?: string;
    src?: string;
    alt?: string;
    fallbackLetters?: number;
}

const Img = styled.img<{ width: string; height: string }>`
    width: ${({ width }) => width};
    height: ${({ height }) => height};
    object-fit: contain;
`;

const EmptyImg = styled.div<{ width: string; height: string }>`
    display: flex;
    justify-content: center;
    align-items: center;
    width: ${({ width }) => width};
    height: ${({ height }) => height};
`;

const Image = ({
    src,
    width = 'auto',
    height = 'auto',
    alt = '-',
    className,
    onLoad,
    onError,
    ...props
}: ImageProps) => {
    const { t } = useTranslation('common');
    const [imageState, setImageState] = useState<ImageState>({
        src,
        status: 'loading',
    });

    if (imageState.src !== src) {
        setImageState({ src, status: 'loading' });
    }

    const status = imageState.src === src ? imageState.status : 'loading';

    if (!src || status === 'error') {
        return (
            <EmptyImg width={width} height={height} className={className} {...props}>
                {t('media.noImage')}
            </EmptyImg>
        );
    }

    const onImageLoad: ReactEventHandler<HTMLImageElement> = event => {
        setImageState({ src, status: 'loaded' });
        onLoad?.(event);
    };

    const onImageError: ReactEventHandler<HTMLImageElement> = event => {
        setImageState({ src, status: 'error' });
        onError?.(event);
    };

    return (
        <Skeleton loading={status === 'loading'}>
            <Img
                {...props}
                width={width}
                height={height}
                src={src}
                alt={alt}
                onLoad={onImageLoad}
                onError={onImageError}
                className={className}
            />
        </Skeleton>
    );
};

export default Image;
