import { Button, Container, Flex } from '@radix-ui/themes';
import { LayoutDashboardIcon, ListIcon, WalletCardsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useSwitchAppMode } from 'hooks/useSwitchAppMode';
import { APP_MODES } from 'store/ui-prefs';

import { EmptyState } from 'basics/empty-states';
import { DashboardHeader } from 'components/dashboard-summary';
import { InternalPageColumnsFromSm } from 'components/internal-page-layout';

const SoloPage = () => {
    const { t } = useTranslation('dashboard');
    const switchAppMode = useSwitchAppMode();
    // While Solo features are unavailable, each placeholder leads back to the group Dashboard
    // (DSH-016), as the mode switch does.
    const goToDashboardAction = (
        <Button type="button" variant="soft" onClick={() => switchAppMode(APP_MODES.GROUP)}>
            <LayoutDashboardIcon size={14} />
            {t('solo.goToDashboard')}
        </Button>
    );

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <InternalPageColumnsFromSm
                sidePanel={
                    <Flex direction="column" gap="4">
                        <DashboardHeader />

                        <EmptyState
                            icon={<WalletCardsIcon size={20} />}
                            iconColor="violet"
                            title={t('solo.summaryTitle')}
                            description={t('solo.inDevelopment')}
                            action={goToDashboardAction}
                        />
                    </Flex>
                }
            >
                <EmptyState
                    icon={<ListIcon size={20} />}
                    iconColor="violet"
                    title={t('solo.activityTitle')}
                    description={t('solo.inDevelopment')}
                    action={goToDashboardAction}
                />
            </InternalPageColumnsFromSm>
        </Container>
    );
};

export { SoloPage };
