import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Box, Container } from '@radix-ui/themes';

import { ACTIVITY_CATEGORIES } from 'constants/activity';
import { getActivityCategory, getActivitySubeventsView } from 'helpers/activityEvent';
import { useActivityStore } from 'store/activity-store';
import { selectActivitySubeventsLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

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
    const { subevents, subeventsParent } = useActivityStore(
        useShallow(state => ({
            subevents: state.subevents,
            subeventsParent: state.subeventsParent,
        })),
    );
    const parentEvent = subeventsParent?.id === parentActivityId
        ? subeventsParent
        : undefined;
    const activityView = getActivitySubeventsView(parentEvent, subevents);
    const isLoading = useLoadingStore(selectActivitySubeventsLoading);
    const activityCategory = getActivityCategory(activityView?.originalEvent);
    const breadcrumbTitle = activityCategory === ACTIVITY_CATEGORIES.SETTLEMENT
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
                        isLoading={isLoading}
                    />
                }
            >
                <ActivitySubeventsHeader
                    parentEvent={activityView?.originalEvent}
                    isLoading={isLoading}
                    isUnavailable={!isLoading && !activityView}
                />

                <ActivitySubeventsFeed
                    parentActivityId={parentActivityId}
                    activityCategory={activityCategory}
                />
            </InternalPageColumnsFromSm>
        </Container>
    );
};

export default ActivitySubeventsPage;
