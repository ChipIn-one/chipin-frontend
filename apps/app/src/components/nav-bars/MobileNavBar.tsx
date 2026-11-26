import { Box, Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { getPreferredModeRoute, isNavigationRouteActive } from 'helpers/routes';
import { useAddExpenseAvailability } from 'hooks/useAddExpenseAvailability';

import { AddExpenseButton } from 'components/AddExpenseButton';
import { NavButton } from 'components/NavButton';

import { getNavElements, type NavElement } from './constants';

import styles from './MobileNavBar.module.css';

const MobileNavBar = () => {
    const location = useLocation();
    const { t } = useTranslation('common');
    const { isSoloMode, isVisible: isAddExpenseVisible } = useAddExpenseAvailability(
        location.pathname,
    );
    const activeColor = isSoloMode ? 'violet' : 'green';
    const navElements = getNavElements(getPreferredModeRoute(isSoloMode));

    const renderNavItem = ({ labelKey, href, Icon }: NavElement) => {
        const isActive = isNavigationRouteActive(location.pathname, href);

        return (
            <Box key={href} flexGrow="1">
                <NavButton
                    className={styles.item}
                    to={href}
                    aria-current={isActive ? 'page' : undefined}
                    color={isActive ? activeColor : 'gray'}
                    radius="none"
                    variant={isActive ? 'solid' : 'surface'}
                >
                    <Flex direction="column" align="center" justify="center" gap="1" py="1">
                        <Icon size={20} />
                        <Text size="1" {...(!isActive && { color: 'gray' })}>
                            {t(labelKey)}
                        </Text>
                    </Flex>
                </NavButton>
            </Box>
        );
    };

    return (
        <Box
            className={styles.root}
            display={{ initial: 'block', sm: 'none' }}
            position="fixed"
            bottom="0"
            left="0"
            right="0"
        >
            <Box className={styles.surface} data-cutout={isAddExpenseVisible} />

            <Flex className={styles.content} position="relative" align="end">
                <Flex width="100%" justify="between" align="end">
                    {navElements.map(renderNavItem)}
                </Flex>

                {isAddExpenseVisible && (
                    <Box className={styles.centerAction}>
                        <AddExpenseButton type="mobile" />
                    </Box>
                )}
            </Flex>
        </Box>
    );
};

export { MobileNavBar };
