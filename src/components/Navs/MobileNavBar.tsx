import { LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { Box, Button, Flex, Text } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

import AddExpenseModal from 'components/Modal/AddExpenseModal';

import { NAV_ELEMENTS } from './constants';

const BoxWrapper = styled(Box)`
    z-index: 10;
    overflow: visible;
`;

const NavSurface = styled(Box)`
    position: absolute;
    inset: 0;
    background: radial-gradient(
        circle var(--space-7) at 50% 0,
        transparent var(--space-7),
        ${themeColor('grass3')} calc(var(--space-7))
    );
`;

const NavContent = styled(Flex)`
    position: relative;
    min-height: var(--space-9);
    align-items: end;
`;

const CenterAction = styled(Box)`
    position: absolute;
    top: 0;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
`;

const ActionButton = styled(Button)`
    width: var(--space-9);
    height: var(--space-9);
    padding: 0;
    border: 6px solid ${themeColor('grass3')};
`;

const NavLink = styled(Link)`
    display: block;
    height: 100%;
`;

const NavItems = styled(Flex)`
    width: 100%;
    align-items: end;
`;

const NavButton = styled(Button)`
    width: 100%;
    min-height: var(--space-9);
    box-shadow: none;
`;

const MobileNavBar = () => {
    const { t } = useTranslation();
    const location = useLocation();

    const renderNavItem = ({ label, href, Icon }: (typeof NAV_ELEMENTS)[number]) => {
        const isActive = location.pathname === href || location.pathname.startsWith(`${href}/`);

        return (
            <Box key={href} flexGrow="1">
                <NavLink to={href}>
                    <NavButton
                        radius="none"
                        variant={isActive ? 'soft' : 'surface'}
                        {...(!isActive && { color: 'gray' })}
                    >
                        <Flex direction="column" align="center" justify="center" gap="1" py="1">
                            <Icon size={20} />
                            <Text size="1" {...(!isActive && { color: 'gray' })}>
                                {label}
                            </Text>
                        </Flex>
                    </NavButton>
                </NavLink>
            </Box>
        );
    };

    return (
        <BoxWrapper
            display={{ initial: 'block', sm: 'none' }}
            position="fixed"
            bottom="0"
            left="0"
            right="0"
        >
            <NavSurface />

            <NavContent align="stretch">
                <NavItems justify="between" align="stretch">
                    {NAV_ELEMENTS.map(renderNavItem)}
                </NavItems>

                <CenterAction>
                    <AddExpenseModal>
                        <ActionButton
                            size="4"
                            radius="full"
                            color="jade"
                            aria-label={t('expenses.modal.submit')}
                        >
                            <LucidePlus size={28} />
                        </ActionButton>
                    </AddExpenseModal>
                </CenterAction>
            </NavContent>
        </BoxWrapper>
    );
};

export default MobileNavBar;
