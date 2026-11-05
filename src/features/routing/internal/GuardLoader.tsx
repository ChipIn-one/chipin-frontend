import { Container, Flex } from '@radix-ui/themes';

import { useConnectivityStore } from 'store/connectivityStore';

import ChipInLoader from 'basics/ChipInLoader';
import PageLoader from 'basics/PageLoader';
import { OfflineBanner } from 'components/offline-banner';

/**
 * The loading state of the route guards. Online it is the plain `PageLoader`; offline (a cold
 * start waiting for the session check) the banner with its Retry sits above the loader, and both
 * fit one screen.
 */
const GuardLoader = () => {
    const isOffline = useConnectivityStore(state => state.mode === 'offline');

    if (!isOffline) {
        return <PageLoader />;
    }

    return (
        <Container size="4">
            <Flex direction="column" minHeight="100vh" pt="4">
                <OfflineBanner />
                <Flex flexGrow="1" justify="center" align="center">
                    <ChipInLoader />
                </Flex>
            </Flex>
        </Container>
    );
};

export { GuardLoader };
