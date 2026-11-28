import { PROP_COLOR } from '@chipin/tokens/theme';
import { Button, Container, Flex, Heading, Text } from '@radix-ui/themes';
import { HouseIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ROUTES } from 'constants/routes';

// A missing group id, or a group the user may not read (403/404): one way back to the dashboard.
const GroupNotFound = () => {
    const { t } = useTranslation(['group', 'common']);

    return (
        <Container size="4">
            <Flex direction="column" align="center" gap="3" py="9">
                <Heading as="h1" size="5" align="center">
                    {t('group:page.notFoundTitle')}
                </Heading>
                <Text color={PROP_COLOR.neutral} align="center">
                    {t('group:page.notFoundDescription')}
                </Text>
                <Button asChild mt="2">
                    <Link to={ROUTES.DASHBOARD}>
                        <HouseIcon size={18} aria-hidden="true" />
                        {t('common:buttons.goToDashboard')}
                    </Link>
                </Button>
            </Flex>
        </Container>
    );
};

export { GroupNotFound };
