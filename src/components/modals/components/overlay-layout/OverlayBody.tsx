import type { ReactNode } from 'react';

import { Body, BodyContent } from './styled';

interface Props {
    children: ReactNode;
    fillHeight?: boolean;
}

const OverlayBody = ({ children, fillHeight = false }: Props) => {
    return (
        <Body type="auto" scrollbars="vertical" $fillHeight={fillHeight}>
            <BodyContent $fillHeight={fillHeight}>{children}</BodyContent>
        </Body>
    );
};

export default OverlayBody;
