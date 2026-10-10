import type { ReactNode } from 'react';

import { Flex, Separator } from '@radix-ui/themes';

import { Header, HeaderContainer } from './styled';

interface Props {
    title: ReactNode;
    closeControl?: ReactNode;
    backControl?: ReactNode;
}

const OverlayHeader = ({ title, closeControl, backControl }: Props) => {
    return (
        <HeaderContainer>
            <Header>
                {backControl ? (
                    <Flex align="center" gap="3" minWidth="0" flexGrow="1">
                        {backControl}
                        {title}
                    </Flex>
                ) : title}
                {closeControl}
            </Header>
            <Separator orientation="horizontal" size="4" />
        </HeaderContainer>
    );
};

export default OverlayHeader;
