import type { ReactNode } from 'react';

import { Footer, FooterContainer, FooterSeparator } from './styled';

interface Props {
    cancelAction: ReactNode;
    primaryAction: ReactNode;
}

const OverlayFooter = ({ cancelAction, primaryAction }: Props) => {
    return (
        <FooterContainer>
            <FooterSeparator orientation="horizontal" size="4" />
            <Footer>
                {cancelAction}
                {primaryAction}
            </Footer>
        </FooterContainer>
    );
};

export default OverlayFooter;
