import styled, { keyframes } from 'styled-components';

interface LoaderProps {
    size?: number; // размер SVG
    strokeWidth?: number; // толщина линии
    gap?: number; // длина "дырки" в пикселях
}

const createAnimation = (circumference: number, gap: number) => keyframes`
  0% {
    stroke-dasharray: 0, ${circumference};
    stroke-dashoffset: 0;
  }
  40% {
    stroke-dasharray: ${circumference - gap}, ${circumference};
    stroke-dashoffset: 0;
  }
  60% {
    stroke-dasharray: ${circumference - gap}, ${circumference};
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dasharray: ${circumference - gap}, ${circumference};
    stroke-dashoffset: -${circumference};
  }
`;

const AnimatedCircle = styled.circle<{ $circ: number; $gap: number }>`
    fill: none;
    stroke: #80c837;
    stroke-linecap: round;
    stroke-width: ${({ strokeWidth }) => strokeWidth || 8}px;
    animation: ${({ $circ, $gap }) => createAnimation($circ, $gap)} 2s ease-in-out infinite;
`;

export const LogoLoader = ({ size = 300, strokeWidth = 20, gap = 200 }: LoaderProps) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            xmlns="http://www.w3.org/2000/svg"
        >
            <AnimatedCircle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={strokeWidth}
                $circ={circumference}
                $gap={gap}
            />
        </svg>
    );
};
