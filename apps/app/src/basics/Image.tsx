import {
    type CSSProperties,
    type ImgHTMLAttributes,
    type ReactEventHandler,
    useState,
} from 'react';
import { Skeleton } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { cx } from 'helpers/cx';

import styles from './Image.module.css';

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

// The size props are any CSS length, so they reach the module as local custom properties.
type SizeStyle = CSSProperties & Record<'--_image-width' | '--_image-height', string>;

const Image = ({
    src,
    width = 'auto',
    height = 'auto',
    alt = '-',
    className,
    style,
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
    const sizeStyle: SizeStyle = { ...style, '--_image-width': width, '--_image-height': height };

    if (!src || status === 'error') {
        return (
            <div className={cx(styles.empty, className)} style={sizeStyle} {...props}>
                {t('media.noImage')}
            </div>
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
            <img
                {...props}
                style={sizeStyle}
                width={width}
                height={height}
                src={src}
                alt={alt}
                onLoad={onImageLoad}
                onError={onImageError}
                className={cx(styles.root, className)}
            />
        </Skeleton>
    );
};

export { Image };
