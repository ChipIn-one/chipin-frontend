import type { ReactNode } from 'react';

import { Separator } from '@radix-ui/themes';

import { Header, HeaderContainer } from './styled';

interface Props {
    title: ReactNode;
    closeControl?: ReactNode;
    safeArea?: boolean;
}

const OverlayHeader = ({ title, closeControl, safeArea = false }: Props) => {
    return (
        <HeaderContainer $safeArea={safeArea}>
            <Header>
                {title}
                {closeControl}
            </Header>
            <Separator orientation="horizontal" size="4" />
        </HeaderContainer>
    );
};

export default OverlayHeader;
