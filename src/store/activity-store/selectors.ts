import type { ActivityStore } from './types';

type ActivitySubeventsFlowSlice = Pick<
    ActivityStore,
    | 'subevents'
    | 'subeventsParent'
    | 'hasMoreSubevents'
    | 'fetchSetActivitySubevents'
    | 'fetchMoreActivitySubevents'
>;

const selectActivitySubeventsFlow = (state: ActivityStore): ActivitySubeventsFlowSlice => ({
    subevents: state.subevents,
    subeventsParent: state.subeventsParent,
    hasMoreSubevents: state.hasMoreSubevents,
    fetchSetActivitySubevents: state.fetchSetActivitySubevents,
    fetchMoreActivitySubevents: state.fetchMoreActivitySubevents,
});

export { selectActivitySubeventsFlow };
