import { Fragment, type ReactNode, useMemo } from 'react';
import { Flex } from '@radix-ui/themes';

import type { ActivityEvent as DomainActivityEvent, ActivityPreview } from 'entities/activity';
import type { ActivityListItem } from 'helpers/activityEvent';
import { getActivityDateKey } from 'helpers/time';
import { useSelfUser } from 'hooks/useSelfUser';

import { NoActivityEmptyState } from 'basics/empty-states';

import { eventRows, legacyActivityRows, previewRows, selectors } from '../../internal';
import { ActivityEvent, FullActivityFeedContext } from '../activity-event';
import ActivityDateDivider from '../ActivityDateDivider';

// One source: the domain previews of the dashboard and group feeds, the domain events of the flat
// log (the Activity page), or the legacy items of the expense history (carried into the domain
// here until 12c migrates it).
type Source =
    | { previews: readonly ActivityPreview[]; log?: never; events?: never }
    | { log: readonly DomainActivityEvent[]; previews?: never; events?: never }
    | { events: readonly ActivityListItem[]; previews?: never; log?: never };

type Props = Source & {
    emptyState?: ReactNode;
    children?: ReactNode;
    isShowSummary?: boolean;
    isNavigable?: boolean;
    isFullActivityFeed?: boolean;
};

const ActivityEventsList = ({
    previews,
    log,
    events,
    emptyState = <NoActivityEmptyState />,
    children,
    isShowSummary = false,
    isNavigable = false,
    isFullActivityFeed = false,
}: Props) => {
    const userId = useSelfUser()?.id;
    const rows = useMemo(() => {
        if (previews) {
            return previewRows(previews);
        }
        return log ? eventRows(log) : legacyActivityRows(events ?? []);
    }, [events, log, previews]);
    const dailyExpenseSummaries = useMemo(
        () => (isShowSummary ? selectors.getDailyExpenseSummary(rows, userId) : {}),
        [rows, isShowSummary, userId],
    );

    if (rows.length === 0) {
        // Pagination/retry controls must remain mounted when a preview page filters to empty.
        return (
            <>
                {emptyState}
                {children}
            </>
        );
    }

    return (
        <FullActivityFeedContext.Provider value={isFullActivityFeed}>
            <Flex direction="column" gap="2">
                {rows.map(({ original: originalEvent, event, isPreview }, index) => {
                    const dateKey = getActivityDateKey(originalEvent.createdAt);
                    const previousEvent = rows[index - 1]?.original;
                    const shouldRenderDivider =
                        previousEvent === undefined ||
                        dateKey !== getActivityDateKey(previousEvent.createdAt);

                    return (
                        <Fragment key={originalEvent.id}>
                            {shouldRenderDivider && (
                                <ActivityDateDivider
                                    createdAt={originalEvent.createdAt}
                                    summary={dailyExpenseSummaries[dateKey] ?? []}
                                />
                            )}
                            <ActivityEvent
                                event={event}
                                parentActivityId={isPreview ? originalEvent.id : undefined}
                                isNavigable={isNavigable}
                            />
                        </Fragment>
                    );
                })}

                {children}
            </Flex>
        </FullActivityFeedContext.Provider>
    );
};

export { ActivityEventsList };
