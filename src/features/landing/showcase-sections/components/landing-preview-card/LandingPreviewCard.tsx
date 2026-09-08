import type { ReactNode } from 'react';

import { PreviewBoundary, PreviewSurface } from './styled';

interface Props {
    children: ReactNode;
    label: string;
}

const LandingPreviewCard = ({ children, label }: Props) => {
    return (
        <PreviewBoundary aria-label={label} role="img">
            <PreviewSurface inert size="1">
                {children}
            </PreviewSurface>
        </PreviewBoundary>
    );
};

export default LandingPreviewCard;
