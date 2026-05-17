import { LucideAlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Flex, Heading, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';

import { NavButton } from 'basics/buttons';

const Page404 = () => {
    const { t } = useTranslation('common');

    return (
        <Flex direction="column" align="center" justify="center" height="100vh" p="4" gap="4">
            <LucideAlertTriangle size={64} strokeWidth={1.5} />
            <Heading size="8" mb="2">
                {t('page404.title')}
            </Heading>
            <Text size="4" mb="4" weight="medium">
                {t('page404.subtitle')}
            </Text>
            <NavButton to={ROUTES.HOME} size="4" variant="solid">
                {t('page404.goHome')}
            </NavButton>
        </Flex>
    );
};

export default Page404;
