import { PROP_COLOR } from '@chipin/tokens/theme';
import { Box, Button, Container, Flex, Heading, Separator, Text } from '@radix-ui/themes';
import { ChartPieIcon, HomeIcon, LayoutListIcon, SearchIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ROUTES } from 'constants/routes';
import { SITE_PATHS } from 'helpers/sitePaths';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import { NavButton } from 'components/NavButton';

import { HintCard, Icon404 } from './components';

import styles from './Page404.module.css';

const Page404 = () => {
    const { t } = useTranslation('errors');
    const isLoggedIn = useAuthStore(selectIsLoggedIn);

    return (
        <Container size="2">
            <Flex direction="column" align="center" justify="center" height="90vh" gap="6">
                <Icon404 />
                <Flex direction="column" align="center" gap="2">
                    <Flex align="center" gap="2">
                        <Heading size="8" color={PROP_COLOR.accent}>
                            {t('page404.code')}
                        </Heading>
                        <Heading size={{ initial: '6', sm: '8' }}>{t('page404.title')}</Heading>
                    </Flex>
                    <Text size="3" color={PROP_COLOR.neutral} align="center">
                        {t('page404.subtitle')}
                    </Text>
                </Flex>

                <Separator size="4" />

                <Flex direction="column" align="center" gap="4">
                    <Text size="4" weight="bold" color={PROP_COLOR.accent}>
                        {t('page404.whatYouCanDo')}
                    </Text>
                    <Flex direction={{ initial: 'column', sm: 'row' }} align="start" gap="4">
                        <HintCard
                            icon={<SearchIcon size={36} strokeWidth={2} />}
                            title={t('page404.checkUrl.title')}
                            description={t('page404.checkUrl.description')}
                        />
                        <Box
                            display={{ initial: 'none', sm: 'inline-block' }}
                            className={styles.divider}
                        >
                            <Separator orientation="vertical" size="4" />
                        </Box>
                        <HintCard
                            icon={<HomeIcon size={36} strokeWidth={2} />}
                            title={t('page404.goDashboard.title')}
                            description={t('page404.goDashboard.description')}
                        />
                        <Box
                            display={{ initial: 'none', sm: 'inline-block' }}
                            className={styles.divider}
                        >
                            <Separator orientation="vertical" size="4" />
                        </Box>
                        <HintCard
                            icon={<LayoutListIcon size={36} strokeWidth={2} />}
                            title={t('page404.explore.title')}
                            description={t('page404.explore.description')}
                        />
                    </Flex>
                </Flex>

                {isLoggedIn ? (
                    <NavButton to={ROUTES.DASHBOARD} size="4" variant="solid" mt="2">
                        <ChartPieIcon size={24} />
                        {t('page404.backToDashboard')}
                    </NavButton>
                ) : (
                    // The site home is a plain link, never a router navigation (spec 04 §2.1).
                    <Button asChild size="4" variant="solid" mt="2">
                        <a href={SITE_PATHS.home()}>
                            <HomeIcon size={24} />
                            {t('page404.goHome')}
                        </a>
                    </Button>
                )}
            </Flex>
        </Container>
    );
};

export { Page404 };
