import type { ActivityStore } from './types';

type ActivityFeedSlice = Pick<ActivityStore, 'items' | 'hasMore'>;
type ActivitySubeventsFlowSlice = Pick<
    ActivityStore,
    | 'subevents'
    | 'hasMoreSubevents'
    | 'subeventsParentId'
    | 'fetchSetActivitySubevents'
    | 'fetchMoreActivitySubevents'
>;

const selectActivityFeed = (state: ActivityStore): ActivityFeedSlice => ({
    items: state.items,
    hasMore: state.hasMore,
});

const selectActivitySubeventsFlow = (
    state: ActivityStore,
): ActivitySubeventsFlowSlice => ({
    subevents: state.subevents,
    hasMoreSubevents: state.hasMoreSubevents,
    subeventsParentId: state.subeventsParentId,
    fetchSetActivitySubevents: state.fetchSetActivitySubevents,
    fetchMoreActivitySubevents: state.fetchMoreActivitySubevents,
});

export { selectActivityFeed, selectActivitySubeventsFlow };
