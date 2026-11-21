import { Container, Flex, Heading, Text } from '@radix-ui/themes';
import { ShieldLockIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { resolveOAuthReturnTo } from 'helpers/url';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import PageLoader from 'basics/PageLoader';
import { AuthButtons } from 'components/AuthButtons';

/**
 * The sign-in screen (spec 04 §2.2 `login`, 04-2f): the guard (`requireSession`) and the site lead
 * here. `?returnTo` is validated as a same-origin app path (`resolveOAuthReturnTo`, default
 * `/dashboard`); a signed-in user goes there at once, the others after the OAuth callback.
 * `?locale` (from the site) is the registration locale when it is a supported locale code.
 */
const LoginPage = () => {
    const { t } = useTranslation('auth');
    const [searchParams] = useSearchParams();
    const { isAuthResolved, isLoggedIn } = useAuthStore(
        useShallow(state => ({
            isAuthResolved: selectIsAuthResolved(state),
            isLoggedIn: selectIsLoggedIn(state),
        })),
    );
    const returnTo = resolveOAuthReturnTo(searchParams.get('returnTo'), window.location.origin);

    if (!isAuthResolved) {
        return <PageLoader />;
    }
    if (isLoggedIn) {
        return <Navigate to={returnTo} replace />;
    }

    return (
        <Container size="1" py={{ initial: '6', sm: '9' }}>
            <Flex direction="column" align="center" gap="6">
                <Heading as="h1" size={{ initial: '7', sm: '8' }} align="center">
                    {t('modal.headlinePrimary')} <br />
                    <Text as="span" color="grass">
                        {t('modal.headlineAccent')}
                    </Text>
                </Heading>
                <Flex direction="column" gap="3" width="100%" maxWidth="360px">
                    <AuthButtons returnTo={returnTo} locale={searchParams.get('locale')} />
                    <Flex align="center" justify="center" gap="2">
                        <Text color="gray">
                            <ShieldLockIcon size={14} />
                        </Text>
                        <Text size="1" color="gray" align="center">
                            {t('modal.trust')}
                        </Text>
                    </Flex>
                </Flex>
            </Flex>
        </Container>
    );
};

export { LoginPage };
