import { Box, Container } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { ACTIVITY_CATEGORIES } from 'constants/activity';
import { getActivityCategory, getActivitySubeventsView } from 'helpers/activityEvent';
import { useActivityHistory } from 'hooks/useActivityHistory';

import { InternalPageColumnsFromSm } from 'components/internal-page-layout';
import { PageBreadcrumb } from 'components/page-breadcrumb';

import {
    ActivitySubeventsDetails,
    ActivitySubeventsFeed,
    ActivitySubeventsHeader,
} from './components';

const ActivitySubeventsPage = () => {
    const { t } = useTranslation('activity');
    const { parentActivityId } = useParams<{ parentActivityId: string }>();
    const history = useActivityHistory(parentActivityId);
    const activityView = getActivitySubeventsView(history.parent, history.events);
    const activityCategory = getActivityCategory(activityView?.originalEvent);
    // Before the chain is known (loading, offline or failed with nothing cached) the title is generic.
    const getBreadcrumbTitle = () => {
        if (!activityView) {
            return t('subeventsTitle');
        }
        return activityCategory === ACTIVITY_CATEGORIES.SETTLEMENT
            ? t('subeventsSettlementHistoryTitle')
            : t('subeventsExpenseHistoryTitle');
    };

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <Box mb="2">
                <PageBreadcrumb title={getBreadcrumbTitle()} />
            </Box>

            <InternalPageColumnsFromSm
                sidePanel={
                    <ActivitySubeventsDetails
                        view={activityView}
                        childEvents={history.events}
                        parentActivityId={parentActivityId}
                        // An unreadable later event: the current state may be newer than shown.
                        canChange={!history.hasInvalidEvents}
                        isLoading={history.isLoading}
                    />
                }
            >
                <ActivitySubeventsHeader
                    parentEvent={activityView?.originalEvent}
                    isLoading={history.isLoading}
                    // Offline with nothing cached the feed says so: the chain may well exist.
                    isUnavailable={!history.isLoading && !history.isOffline && !activityView}
                />

                <ActivitySubeventsFeed history={history} />
            </InternalPageColumnsFromSm>
        </Container>
    );
};

export default ActivitySubeventsPage;
