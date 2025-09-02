import styled from 'styled-components';

import { blueDark, greenDark, violetDark } from '@radix-ui/colors';
import { Box } from '@radix-ui/themes';

import { hexToRgba } from 'helpers/colors';

const ColoredBox = styled(Box)`
    background-image: radial-gradient(
            circle at 20% 20%,
            ${hexToRgba(blueDark.blue9, 0.2)},
            transparent 40%
        ),
        radial-gradient(circle at 80% 30%, ${hexToRgba(greenDark.green9, 0.2)}, transparent 40%),
        radial-gradient(circle at 40% 80%, ${hexToRgba(violetDark.violet9, 0.25)}, transparent 40%);
`;

// const HeroSection = styled(Section)`
//     background: radial-gradient(ellipse at top, rgba(99, 102, 241, 0.2), transparent),
//         radial-gradient(ellipse at bottom, rgba(16, 185, 129, 0.2), transparent), #0f172a;

//     background: repeating-linear-gradient(
//             45deg,
//             rgba(139, 92, 246, 0.1) 0 2px,
//             transparent 2px 40px
//         ),
//         linear-gradient(to bottom, #0f172a, #1e293b);

//     background: repeating-linear-gradient(
//             -45deg,
//             rgba(16, 185, 129, 0.1) 0 4px,
//             transparent 4px 40px
//         ),
//         linear-gradient(to top, #0f172a, #1e293b);

//     background: radial-gradient(circle at 10% 20%, rgba(244, 63, 94, 0.12), transparent 30%),
//         radial-gradient(circle at 80% 70%, rgba(16, 185, 129, 0.12), transparent 40%),
//         radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.1), transparent 45%), #0f172a;

//     background: radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.2), transparent 50%),
//         radial-gradient(circle at 70% 80%, rgba(16, 185, 129, 0.15), transparent 50%),
//         linear-gradient(to bottom, #0f172a, #111827);
// `;

interface Props {
    children: React.ReactNode;
}

const BackgroundBox = ({ children }: Props) => {
    return <ColoredBox minHeight="100vh">{children}</ColoredBox>;
};

export default BackgroundBox;
