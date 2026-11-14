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
    const breadcrumbTitle =
        activityCategory === ACTIVITY_CATEGORIES.SETTLEMENT
            ? t('subeventsSettlementHistoryTitle')
            : t('subeventsExpenseHistoryTitle');

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            {activityView ? (
                <Box mb="2">
                    <PageBreadcrumb title={breadcrumbTitle} />
                </Box>
            ) : null}

            <InternalPageColumnsFromSm
                sidePanel={
                    <ActivitySubeventsDetails
                        view={activityView}
                        childEvents={history.events}
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
