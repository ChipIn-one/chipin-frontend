import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { Box, Flex, Text } from '@radix-ui/themes';

import { NavButton } from 'basics/buttons';

import { NAV_ELEMENTS } from './constants';

const HeaderNav = () => {
    const location = useLocation();
    const { t } = useTranslation('common');

    return (
        <Box display={{ initial: 'none', sm: 'block' }}>
            <Flex justify="between" align="center" gap="5">
                {NAV_ELEMENTS.map(({ href, labelKey, Icon }) => {
                    const isActive =
                        location.pathname === href || location.pathname.startsWith(`${href}/`);

                    return (
                        <NavButton
                            key={href}
                            to={href}
                            variant="ghost"
                            size="3"
                            {...(!isActive && { color: 'gray' })}
                        >
                            <Icon size={24} />
                            <Text size="2" weight="bold">
                                {t(labelKey)}
                            </Text>
                        </NavButton>
                    );
                })}
            </Flex>
        </Box>
    );
};

export default HeaderNav;
