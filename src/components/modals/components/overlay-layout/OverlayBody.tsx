import type { ReactNode } from 'react';

import { Body, BodyContent } from './styled';

interface Props {
    children: ReactNode;
}

const OverlayBody = ({ children }: Props) => {
    return (
        <Body type="auto" scrollbars="vertical">
            <BodyContent>{children}</BodyContent>
        </Body>
    );
};

export default OverlayBody;
