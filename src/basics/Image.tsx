import { type ImgHTMLAttributes, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
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
    ...props
}: Props) => {
    const { t } = useTranslation('common');
    const [isError, setIsError] = useState(false);

    if (isError || !src) {
        return (
            <EmptyImg width={width} height={height} className={className} {...props}>
                {t('media.noImage')}
            </EmptyImg>
        );
    }

    return (
        <Img
            width={width}
            height={height}
            src={src}
            alt={alt}
            onError={() => {
                setIsError(true);
            }}
            className={className}
            {...props}
        />
    );
};

export default Image;
