import { LucideHome, LucideLayoutList, LucideSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Container, Flex, Heading, Separator, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import { NavButton } from 'basics/buttons';

import { HintCard, Icon404 } from './components';

const Page404 = () => {
    const { t } = useTranslation('common');
    const isLoggedIn = useAuthStore(selectIsLoggedIn);

    const buttonRoute = isLoggedIn ? ROUTES.DASHBOARD : ROUTES.HOME;
    const buttonKey = isLoggedIn ? 'page404.backToDashboard' : 'page404.goHome';

    return (
        <Container size="2">
            <Flex direction="column" align="center" justify="center" height="90vh" gap="6">
                <Icon404 />
                <Flex direction="column" align="center" gap="2">
                    <Flex align="center" gap="2">
                        <Heading size="8" color="green">
                            {t('page404.code')}
                        </Heading>
                        <Heading size={{ initial: '6', sm: '8' }}>{t('page404.title')}</Heading>
                    </Flex>
                    <Text size="3" color="gray" align="center">
                        {t('page404.subtitle')}
                    </Text>
                </Flex>

                <Separator size="4" />

                <Flex direction="column" align="center" gap="4">
                    <Text size="4" weight="bold" color="green">
                        {t('page404.whatYouCanDo')}
                    </Text>
                    <Flex direction={{ initial: 'column', sm: 'row' }} align="start" gap="4">
                        <HintCard
                            icon={<LucideSearch size={36} strokeWidth={2} />}
                            title={t('page404.checkUrl.title')}
                            description={t('page404.checkUrl.description')}
                        />
                        <Box
                            display={{ initial: 'none', sm: 'inline-block' }}
                            style={{ alignSelf: 'stretch' }}
                        >
                            <Separator orientation="vertical" size="4" />
                        </Box>
                        <HintCard
                            icon={<LucideHome size={36} strokeWidth={2} />}
                            title={t('page404.goDashboard.title')}
                            description={t('page404.goDashboard.description')}
                        />
                        <Box
                            display={{ initial: 'none', sm: 'inline-block' }}
                            style={{ alignSelf: 'stretch' }}
                        >
                            <Separator orientation="vertical" size="4" />
                        </Box>
                        <HintCard
                            icon={<LucideLayoutList size={36} strokeWidth={2} />}
                            title={t('page404.explore.title')}
                            description={t('page404.explore.description')}
                        />
                    </Flex>
                </Flex>

                <NavButton to={buttonRoute} size="4" variant="solid" mt="2">
                    <LucideHome size={16} />
                    {t(buttonKey)}
                </NavButton>
            </Flex>
        </Container>
    );
};

export default Page404;
