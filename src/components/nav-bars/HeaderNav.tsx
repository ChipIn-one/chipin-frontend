import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { Box, Button, Flex, Text } from '@radix-ui/themes';

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
                        <Link key={href} to={href}>
                            <Button variant="ghost" size="3" {...(!isActive && { color: 'gray' })}>
                                <Icon size={24} />
                                <Text size="2" weight="bold">
                                    {t(labelKey)}
                                </Text>
                            </Button>
                        </Link>
                    );
                })}
            </Flex>
        </Box>
    );
};

export default HeaderNav;
