import { useCallback, useMemo } from 'react';
import { Button, Container, Flex, Spinner, Text } from '@radix-ui/themes';
import { ChevronsDownIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { useShallow } from 'zustand/react/shallow';

import { useCurrencyRatesQuery } from 'entities/currency-rates';
import { useDashboardActivityQuery, useDashboardBalancesQuery } from 'entities/dashboard';
import { ActivityEventsList } from 'features/activity';
import { getActivityPreviewEvents } from 'helpers/activityEvent';
import { useInfiniteScroll } from 'hooks/useInfiniteScroll';
import { useKnownUsers } from 'hooks/useKnownUsers';
import { useSelfUser } from 'hooks/useSelfUser';
import { useErrorsStore } from 'store/errorsStore';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupListFetched, selectUserSelfFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import { EmptyState, NoGroupsEmptyState } from 'basics/empty-states';
import { DashboardOnboarding } from 'components/dashboard-onboarding';
import { DashboardHeader, DashboardSummary } from 'components/dashboard-summary';
import GroupsCards from 'components/GroupsCards';
import { InternalPageColumnsFromSm } from 'components/internal-page-layout';
import { CreateUpdateGroupModal } from 'components/modals/create-update-group-modal';
import { ActivityFeedSkeleton } from 'components/skeletons';

const FullWidthButton = styled(Button)`
    width: 100%;
`;

interface Resource {
    fetched: boolean;
    snapshot: boolean;
    error: boolean;
}

// A query as a resource of the page: a failed load is an error; it blocks the page only while
// there is no data yet (spec 03 §1.2). Waiting for the network (offline) is an error only without
// data: with data, the offline banner alone says so (spec 03 §1.8).
const queryResource = (query: { data: unknown; isError: boolean; isPaused: boolean }): Resource => {
    const snapshot = query.data !== undefined;
    const error = query.isError || (query.isPaused && !snapshot);

    return { fetched: snapshot || error, snapshot, error };
};

const DashboardPage = () => {
    const { t } = useTranslation(['dashboard', 'activity']);
    const balancesQuery = useDashboardBalancesQuery();
    const activityQuery = useDashboardActivityQuery();
    const ratesQuery = useCurrencyRatesQuery();
    const { groups, hasConfirmedGroups } = useGroupsStore(
        useShallow(state => ({
            groups: state.groups,
            hasConfirmedGroups: state.hasConfirmedGroups,
        })),
    );
    const knownUsers = useKnownUsers();
    const friends = knownUsers.friends ?? [];
    const currentUser = useSelfUser();
    const { isGroupListFetched, isUserSelfFetched } = useLoadingStore(
        useShallow(state => ({
            isGroupListFetched: selectGroupListFetched(state),
            isUserSelfFetched: selectUserSelfFetched(state),
        })),
    );
    const { groupListError, userSelfError } = useErrorsStore(
        useShallow(state => ({
            groupListError: state.errors.group.list,
            userSelfError: state.errors.users.self,
        })),
    );

    const activityItems = useMemo(
        () => activityQuery.data?.pages.flatMap(page => page.items) ?? [],
        [activityQuery.data],
    );
    const activityEvents = useMemo(() => getActivityPreviewEvents(activityItems), [activityItems]);
    const balances = queryResource(balancesQuery);
    // A failed next page keeps the feed and has its own inline Retry: not a page error.
    const activity = queryResource({
        data: activityQuery.data,
        isError: activityQuery.isError && !activityQuery.isFetchNextPageError,
        isPaused: activityQuery.isPaused,
    });
    const hasGroups = groups.length > 0;
    const hasConnections = hasGroups || friends.length > 0;
    const hasExpenseHistory =
        groups.some(group => group.lastUsedCurrency !== null) ||
        friends.some(friend => friend.lastUsedCurrency !== null);
    const { hasNextPage: hasMoreActivity, isFetchingNextPage: isNextPageLoading } = activityQuery;
    const isNextPageError = activityQuery.isFetchNextPageError;
    const resources: Resource[] = [
        balances,
        activity,
        {
            fetched: isGroupListFetched,
            snapshot: hasConfirmedGroups,
            error: groupListError !== null,
        },
        {
            fetched: !knownUsers.isLoading,
            snapshot: knownUsers.friends !== undefined,
            error: knownUsers.isError || knownUsers.hasRefreshError,
        },
        {
            fetched: isUserSelfFetched,
            snapshot: currentUser !== null,
            error: userSelfError !== null,
        },
    ];
    const isOnboardingDataSettled = resources.every(({ fetched, snapshot }) => fetched || snapshot);
    const hasOnboardingDataError =
        currentUser === null || resources.some(({ error, snapshot }) => error && !snapshot);
    const hasNonBlockingRefreshError =
        queryResource(ratesQuery).error ||
        resources.some(({ error, snapshot }) => error && snapshot);
    const dashboardView = !isOnboardingDataSettled
        ? 'loading'
        : hasOnboardingDataError
          ? 'error'
          : hasConnections
            ? 'dashboard'
            : 'welcome';
    const isDashboardFetched = balances.fetched && activity.fetched;
    const isEndOfFeed = !isNextPageLoading && !hasMoreActivity && activityItems.length > 0;
    const onRetryLoad = () => {
        void balancesQuery.refetch();
        void activityQuery.refetch();
        void ratesQuery.refetch();
        void knownUsers.refetch();
        Promise.all([
            useGroupsStore.getState().fetchSetGroups(true),
            useUsersStore.getState().fetchSetUser(true),
        ]).catch(() => undefined);
    };
    const { fetchNextPage } = activityQuery;

    const onLoadMore = useCallback(() => {
        void fetchNextPage();
    }, [fetchNextPage]);

    // Any fetch of the feed holds the next page: a refetch replaces the pages it would extend.
    const sentinelRef = useInfiniteScroll({
        hasMore: hasMoreActivity && !isNextPageError,
        isLoading: activityQuery.isFetching,
        onLoadMore,
    });

    const onRetryNextPage = () => {
        onLoadMore();
    };

    const sidePanel =
        dashboardView === 'error' ? null : (
            <Flex direction="column" gap="4">
                <DashboardHeader />

                <DashboardSummary
                    isLoading={balancesQuery.isLoading}
                    hasExpenseHistory={hasExpenseHistory}
                />

                <Flex
                    gap="4"
                    direction="column"
                    display={
                        dashboardView === 'welcome' ? { initial: 'none', sm: 'flex' } : undefined
                    }
                    data-testid="dashboard-groups-section"
                >
                    {!isDashboardFetched ||
                    !(isGroupListFetched || hasConfirmedGroups) ||
                    hasGroups ? (
                        <GroupsCards groups={groups} label={t('groups.title')} />
                    ) : (
                        <NoGroupsEmptyState
                            action={
                                dashboardView !== 'dashboard' ? undefined : (
                                    <CreateUpdateGroupModal type="create">
                                        <FullWidthButton size="2" variant="soft">
                                            <PlusIcon size={14} />
                                            {t('common:buttons.createGroup')}
                                        </FullWidthButton>
                                    </CreateUpdateGroupModal>
                                )
                            }
                        />
                    )}
                </Flex>
            </Flex>
        );

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <InternalPageColumnsFromSm sidePanel={sidePanel}>
                {hasNonBlockingRefreshError &&
                    dashboardView !== 'loading' &&
                    dashboardView !== 'error' && (
                        <Flex
                            align="center"
                            justify="between"
                            gap="3"
                            wrap="wrap"
                            py="2"
                            role="alert"
                        >
                            <Text size="2" color="gray">
                                {t('errors.loadDescription')}
                            </Text>
                            <Button type="button" size="1" variant="soft" onClick={onRetryLoad}>
                                <RefreshCwIcon size={14} />
                                {t('activity:retryAction')}
                            </Button>
                        </Flex>
                    )}
                {dashboardView === 'welcome' ? (
                    <DashboardOnboarding />
                ) : dashboardView === 'loading' ? (
                    <ActivityFeedSkeleton isShowSummary />
                ) : dashboardView === 'error' ? (
                    <EmptyState
                        icon={<RefreshCwIcon size={20} />}
                        title={t('errors.loadTitle')}
                        description={t('errors.loadDescription')}
                        action={
                            <Button type="button" variant="soft" onClick={onRetryLoad}>
                                <RefreshCwIcon size={14} />
                                {t('activity:retryAction')}
                            </Button>
                        }
                    />
                ) : (
                    <ActivityEventsList events={activityEvents} isShowSummary isNavigable>
                        <>
                            {isNextPageLoading && (
                                <Flex justify="center" py="4">
                                    <Spinner size="3" />
                                </Flex>
                            )}

                            {isNextPageError && (
                                <Flex justify="center" py="4">
                                    <Button
                                        type="button"
                                        size="1"
                                        variant="soft"
                                        onClick={onRetryNextPage}
                                    >
                                        <RefreshCwIcon size={14} />
                                        {t('activity:retryAction')}
                                    </Button>
                                </Flex>
                            )}

                            {isEndOfFeed && (
                                <Flex justify="center" align="center" gap="2" py="4">
                                    <Text as="span" color="gray">
                                        <ChevronsDownIcon size={14} />
                                    </Text>
                                    <Text size="1" color="gray">
                                        {t('activity:endOfFeed')}
                                    </Text>
                                </Flex>
                            )}

                            <div ref={sentinelRef} />
                        </>
                    </ActivityEventsList>
                )}
            </InternalPageColumnsFromSm>
        </Container>
    );
};

export default DashboardPage;
