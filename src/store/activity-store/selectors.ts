import type { ActivityStore } from './types';

type ActivityFeedSlice = Pick<ActivityStore, 'items' | 'hasMore'>;
type ActivitySubeventsFlowSlice = Pick<
    ActivityStore,
    | 'subevents'
    | 'subeventsParent'
    | 'hasMoreSubevents'
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
    subeventsParent: state.subeventsParent,
    hasMoreSubevents: state.hasMoreSubevents,
    fetchSetActivitySubevents: state.fetchSetActivitySubevents,
    fetchMoreActivitySubevents: state.fetchMoreActivitySubevents,
});

export { selectActivityFeed, selectActivitySubeventsFlow };
