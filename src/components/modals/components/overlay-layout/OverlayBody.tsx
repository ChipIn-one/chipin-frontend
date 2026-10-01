import type { ReactNode } from 'react';

import { Body, BodyContent } from './styled';

interface Props {
    children: ReactNode;
    fillHeight?: boolean;
    maxHeight?: string;
}

const OverlayBody = ({ children, fillHeight = false, maxHeight }: Props) => {
    return (
        <Body
            type="auto"
            scrollbars="vertical"
            $fillHeight={fillHeight}
            $maxHeight={maxHeight}
        >
            <BodyContent $fillHeight={fillHeight}>{children}</BodyContent>
        </Body>
    );
};

export default OverlayBody;
