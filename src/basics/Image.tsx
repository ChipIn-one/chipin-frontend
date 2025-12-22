import { FC, useState } from 'react';
import styled from 'styled-components';

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
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

const Emptyimg = styled.div<{ width: string; height: string }>`
    display: flex;
    justify-content: center;
    align-items: center;
    width: ${({ width }) => width};
    height: ${({ height }) => height};
`;

const Image: FC<Props> = ({
    src,
    width = 'auto',
    height = 'auto',
    alt = '-',
    className,
    ...props
}) => {
    const [isError, setIsError] = useState(false);

    if (isError || !src) {
        return (
            <Emptyimg width={width} height={height} className={className} {...props}>
                No image
            </Emptyimg>
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
