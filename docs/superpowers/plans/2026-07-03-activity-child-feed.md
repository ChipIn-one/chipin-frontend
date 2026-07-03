# Activity Child Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/activity/:parentActivityId`, make expense and settlement activity cards navigate there, and load paginated child activity events from the backend.

**Architecture:** Add a child activity API wrapper and keep child feed state separate from the existing main activity feed in `activityStore`. The new route renders a small page/header around the existing `ActivityEventsList`, while `EventRenderer` makes only expense and settlement events navigable.

**Tech Stack:** Vite, React 19, TypeScript strict, React Router, Zustand, Radix Themes, styled-components, i18next, Axios.

---

## File Structure

- Modify `src/api/chipin.params.ts`: define activity child fetch params and category type.
- Modify `src/api/chipin.types.ts`: re-export the new params and category type.
- Modify `src/api/chipin.ts`: add `fetchApiUserActivityChildren`.
- Modify `src/store/loadingStore.ts`: add child activity loading fields.
- Modify `src/store/loadingSelectors.ts`: add child activity loading selectors.
- Modify `src/store/activityStore.ts`: add separate child feed state/actions.
- Modify `src/features/activity/selectors.ts`: add `getActivityChildCategory`.
- Create `src/features/activity/ActivityChildrenHeader.tsx`: header for the child feed route.
- Modify `src/features/activity/index.ts`: export the child header.
- Modify `src/features/activity/components/EventRenderer.tsx`: wrap expense and settlement events in navigation.
- Modify `src/constants/routes.ts`: add a route builder and static meta entry.
- Create `src/pages/ActivityChildrenPage.tsx`: protected page for child activities.
- Modify `src/features/routing/AppRouter.tsx`: register `/activity/:parentActivityId`.
- Modify all activity locale files: add child page and empty-state copy.

---

### Task 1: Add API Types And Endpoint

**Files:**
- Modify: `src/api/chipin.params.ts`
- Modify: `src/api/chipin.types.ts`
- Modify: `src/api/chipin.ts`

- [ ] **Step 1: Add child activity params**

In `src/api/chipin.params.ts`, replace the existing `FetchActivityParams` block at the bottom with:

```ts
export interface FetchActivityParams {
    limit?: number;
    cursor?: number;
}

export type ActivityCategory = 'expense' | 'settlement';

export interface FetchActivityChildrenParams extends FetchActivityParams {
    parentActivityId: string;
    category?: ActivityCategory;
}
```

- [ ] **Step 2: Re-export the new API types**

In `src/api/chipin.types.ts`, update the params re-export block so it includes the two new symbols:

```ts
export type {
    ActivityCategory,
    CreateGroupParams,
    CreateLedgerEntryParams,
    CreateSettlementParams,
    FetchActivityChildrenParams,
    FetchActivityParams,
    InviteToGroupParams,
    KickGroupMemberParams,
    LeaveGroupParams,
    RemoveGroupParams,
    SharingMode,
    SharingModeType,
    UpdateGroupParams,
    UpdateUserParams,
} from './chipin.params';
```

- [ ] **Step 3: Import the child params in the API module**

In `src/api/chipin.ts`, add `FetchActivityChildrenParams` to the type import list from `./chipin.types`:

```ts
    FetchActivityChildrenParams,
    FetchActivityParams,
```

- [ ] **Step 4: Add the child activity API wrapper**

In `src/api/chipin.ts`, insert this function immediately after `fetchApiUserActivities`:

```ts
export const fetchApiUserActivityChildren = ({
    parentActivityId,
    limit,
    cursor,
    category,
}: FetchActivityChildrenParams): Promise<ApiActivityItemsResponse> => {
    return apiInstance
        .get(`/users/self/activities/${parentActivityId}/children`, {
            params: {
                ...(limit && { limit }),
                ...(cursor && { cursor }),
                ...(category && { category }),
            },
        })
        .then(result => result.data);
};
```

- [ ] **Step 5: Run typecheck for API types**

Run: `npm run typecheck`

Expected: TypeScript completes without errors.

---

### Task 2: Add Child Feed Store State

**Files:**
- Modify: `src/store/loadingStore.ts`
- Modify: `src/store/loadingSelectors.ts`
- Modify: `src/store/activityStore.ts`

- [ ] **Step 1: Extend loading store state**

In `src/store/loadingStore.ts`, change the `activity` slice in `LoadingStore` to:

```ts
    activity: {
        data: LoadingState;
        nextPage: LoadingState;
        childData: LoadingState;
        childNextPage: LoadingState;
    };
```

Then change the `activity` value in `initialLoadingStore` to:

```ts
    activity: {
        data: 'initial',
        nextPage: 'initial',
        childData: 'initial',
        childNextPage: 'initial',
    },
```

- [ ] **Step 2: Add loading selectors**

In `src/store/loadingSelectors.ts`, insert these selectors after the existing activity selectors:

```ts
export const selectActivityChildrenLoading = (s: LoadingStore) =>
    s.activity.childData === 'loading';
export const selectActivityChildrenFetched = (s: LoadingStore) =>
    s.activity.childData === 'fetched';
export const selectActivityChildrenNextPageLoading = (s: LoadingStore) =>
    s.activity.childNextPage === 'loading';
```

- [ ] **Step 3: Add child state types to activity store**

In `src/store/activityStore.ts`, update the imports:

```ts
import { AppEvent } from 'api/activity.types';
import {
    createApiExpense,
    createApiSettlement,
    fetchApiUserActivities,
    fetchApiUserActivityChildren,
} from 'api/chipin';
import {
    ActivityCategory,
    CreateLedgerEntryParams as CreateExpenseParams,
    CreateSettlementParams,
} from 'api/chipin.types';
```

Add this interface after `const ACTIVITY_PAGE_LIMIT = 15;`:

```ts
interface FetchSetChildActivityParams {
    parentActivityId: string;
    category?: ActivityCategory;
}
```

Extend `ActivityStore` with:

```ts
    childItems: AppEvent[];
    childNextCursor: number | null;
    childHasMore: boolean;
    childParentActivityId: string | null;
    childCategory: ActivityCategory | null;

    fetchSetChildActivity: (params: FetchSetChildActivityParams) => void;
    fetchMoreChildActivity: () => void;
    setInitialChildActivityStore: () => void;
```

- [ ] **Step 4: Add child initial state**

In `src/store/activityStore.ts`, add a child initial object after `initialActivityStore`:

```ts
const initialChildActivityStore = {
    childItems: [],
    childNextCursor: null,
    childHasMore: true,
    childParentActivityId: null,
    childCategory: null,
};
```

Include it in the store initializer:

```ts
export const useActivityStore = create<ActivityStore>((set, get) => ({
    ...initialActivityStore,
    ...initialChildActivityStore,
```

- [ ] **Step 5: Add child fetch actions**

In `src/store/activityStore.ts`, insert these actions before `createExpense`:

```ts
    fetchSetChildActivity: ({ parentActivityId, category }) => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('activity', 'childData', 'loading');

        fetchApiUserActivityChildren({
            parentActivityId,
            category,
            limit: ACTIVITY_PAGE_LIMIT,
        })
            .then(data => {
                set({
                    childItems: data.items,
                    childNextCursor: data.nextCursor,
                    childHasMore: data.nextCursor !== null,
                    childParentActivityId: parentActivityId,
                    childCategory: category ?? null,
                });
                setLoading('activity', 'childData', 'fetched');
            })
            .catch(() => {
                set({
                    childItems: [],
                    childNextCursor: null,
                    childHasMore: false,
                    childParentActivityId: parentActivityId,
                    childCategory: category ?? null,
                });
                setLoading('activity', 'childData', 'fetched');
            });
    },

    fetchMoreChildActivity: () => {
        const { childNextCursor, childItems, childParentActivityId, childCategory } = get();

        if (!childNextCursor || !childParentActivityId) {
            return;
        }

        const { setLoading } = useLoadingStore.getState();
        setLoading('activity', 'childNextPage', 'loading');

        fetchApiUserActivityChildren({
            parentActivityId: childParentActivityId,
            category: childCategory ?? undefined,
            limit: ACTIVITY_PAGE_LIMIT,
            cursor: childNextCursor,
        })
            .then(data => {
                set({
                    childItems: [...childItems, ...data.items],
                    childNextCursor: data.nextCursor,
                    childHasMore: data.nextCursor !== null,
                });
                setLoading('activity', 'childNextPage', 'fetched');
            })
            .catch(() => {
                setLoading('activity', 'childNextPage', 'fetched');
            });
    },

    setInitialChildActivityStore: () => {
        set(initialChildActivityStore);
    },
```

- [ ] **Step 6: Preserve full activity reset behavior**

In `src/store/activityStore.ts`, change `setInitialActivityStore` to reset both main and child activity state:

```ts
    setInitialActivityStore: () => {
        set({
            ...initialActivityStore,
            ...initialChildActivityStore,
        });
    },
```

- [ ] **Step 7: Run typecheck for store changes**

Run: `npm run typecheck`

Expected: TypeScript completes without errors.

---

### Task 3: Add Category Selector

**Files:**
- Modify: `src/features/activity/selectors.ts`

- [ ] **Step 1: Import the category type**

In `src/features/activity/selectors.ts`, add:

```ts
import type { ActivityCategory } from 'api/chipin.types';
```

- [ ] **Step 2: Add selector for child category**

At the bottom of `src/features/activity/selectors.ts`, add:

```ts
export const getActivityChildCategory = (event?: AppEvent): ActivityCategory | undefined => {
    if (!event) {
        return undefined;
    }

    if (event.action === ACTIVITY_ACTIONS.EXPENSE_CREATED) {
        return 'expense';
    }

    if (event.action === ACTIVITY_ACTIONS.SETTLEMENT_CREATED) {
        return 'settlement';
    }

    return undefined;
};
```

- [ ] **Step 3: Run typecheck for selector narrowing**

Run: `npm run typecheck`

Expected: TypeScript completes without errors.

---

### Task 4: Add Child Page Header And i18n

**Files:**
- Create: `src/features/activity/ActivityChildrenHeader.tsx`
- Modify: `src/features/activity/index.ts`
- Modify: `src/i18n/locales/en/activity.json`
- Modify: `src/i18n/locales/es/activity.json`
- Modify: `src/i18n/locales/pt-BR/activity.json`
- Modify: `src/i18n/locales/pt-PT/activity.json`
- Modify: `src/i18n/locales/ru/activity.json`

- [ ] **Step 1: Create child activity header**

Create `src/features/activity/ActivityChildrenHeader.tsx`:

```tsx
import { LucideArrowLeft, LucideListTree } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Box, Flex, IconButton, Skeleton, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';

import { NavButton } from 'basics/buttons';

interface Props {
    isLoading: boolean;
}

const ActivityChildrenHeader = ({ isLoading }: Props) => {
    const { t } = useTranslation('activity');

    return (
        <Box mb="4">
            <Flex justify="between" align="center">
                <Flex align="center" gap="3">
                    <NavButton to={ROUTES.ACTIVITY} variant="ghost" radius="full">
                        <LucideArrowLeft size={18} />
                    </NavButton>

                    <Skeleton loading={isLoading}>
                        <Avatar
                            size={{ initial: '4', sm: '5' }}
                            color="cyan"
                            fallback={<LucideListTree size={30} />}
                        />
                    </Skeleton>

                    <Flex direction="column">
                        <Text size="4" weight="medium" mb="1">
                            <Skeleton loading={isLoading}>{t('childTitle')}</Skeleton>
                        </Text>

                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>{t('childSubtitle')}</Skeleton>
                        </Text>
                    </Flex>
                </Flex>

                <IconButton variant="ghost" disabled>
                    <LucideListTree size={20} />
                </IconButton>
            </Flex>
        </Box>
    );
};

export default ActivityChildrenHeader;
```

- [ ] **Step 2: Export the header**

In `src/features/activity/index.ts`, change the file to:

```ts
import Activity from './Activity';
import ActivityChildrenHeader from './ActivityChildrenHeader';
import ActivityHeader from './ActivityHeader';

export { ActivityChildrenHeader, ActivityHeader };
export default Activity;
```

- [ ] **Step 3: Add English activity copy**

In `src/i18n/locales/en/activity.json`, add these keys after `endOfFeed`:

```json
    "childTitle": "Activity details",
    "childSubtitle": "Updates related to this activity",
    "childEmptyTitle": "No updates yet",
    "childEmptyDescription": "Changes to this expense or settlement will appear here.",
```

- [ ] **Step 4: Add Spanish activity copy**

In `src/i18n/locales/es/activity.json`, add these keys after `endOfFeed`:

```json
    "childTitle": "Detalles de actividad",
    "childSubtitle": "Actualizaciones relacionadas con esta actividad",
    "childEmptyTitle": "Aún no hay actualizaciones",
    "childEmptyDescription": "Los cambios de este gasto o pago aparecerán aquí.",
```

- [ ] **Step 5: Add Brazilian Portuguese activity copy**

In `src/i18n/locales/pt-BR/activity.json`, add these keys after `endOfFeed`:

```json
    "childTitle": "Detalhes da atividade",
    "childSubtitle": "Atualizações relacionadas a esta atividade",
    "childEmptyTitle": "Ainda não há atualizações",
    "childEmptyDescription": "As alterações desta despesa ou pagamento aparecerão aqui.",
```

- [ ] **Step 6: Add European Portuguese activity copy**

In `src/i18n/locales/pt-PT/activity.json`, add these keys after `endOfFeed`:

```json
    "childTitle": "Detalhes da atividade",
    "childSubtitle": "Atualizações relacionadas com esta atividade",
    "childEmptyTitle": "Ainda não há atualizações",
    "childEmptyDescription": "As alterações desta despesa ou pagamento aparecerão aqui.",
```

- [ ] **Step 7: Add Russian activity copy**

In `src/i18n/locales/ru/activity.json`, add these keys after `endOfFeed`:

```json
    "childTitle": "Детали активности",
    "childSubtitle": "Обновления, связанные с этой активностью",
    "childEmptyTitle": "Обновлений пока нет",
    "childEmptyDescription": "Изменения этой траты или расчёта появятся здесь.",
```

- [ ] **Step 8: Run typecheck after i18n/header changes**

Run: `npm run typecheck`

Expected: TypeScript completes without errors.

---

### Task 5: Create Child Activity Page And Route

**Files:**
- Create: `src/pages/ActivityChildrenPage.tsx`
- Modify: `src/constants/routes.ts`
- Modify: `src/features/routing/AppRouter.tsx`

- [ ] **Step 1: Add activity child route constants**

In `src/constants/routes.ts`, add this helper after `ROUTES`:

```ts
export const buildActivityChildrenRoute = (parentActivityId: string) =>
    `${ROUTES.ACTIVITY}/${parentActivityId}`;
```

Add this meta entry after the `ROUTES.ACTIVITY` entry:

```ts
    [buildActivityChildrenRoute(':parentActivityId')]: {
        title: 'ChipIn — Activity Details',
        description: 'View updates related to an activity event',
    },
```

- [ ] **Step 2: Create child activity page**

Create `src/pages/ActivityChildrenPage.tsx`:

```tsx
import { useEffect, useMemo } from 'react';
import { LucideChevronsDown, LucideListTree } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { Container, Flex, Spinner, Text } from '@radix-ui/themes';
import { useIntersectionObserver } from '@uidotdev/usehooks';

import { getActivityChildCategory } from 'features/activity/selectors';
import { ActivityChildrenHeader } from 'features/activity';
import { ActivityEventsList } from 'features/activity/components';
import {
    selectActivityChildrenLoading,
    selectActivityChildrenNextPageLoading,
} from 'store/loadingSelectors';
import { useActivityStore } from 'store/activityStore';
import { useLoadingStore } from 'store/loadingStore';

import { EmptyState } from 'basics/empty-states';
import { ActivityFeedSkeleton } from 'components/skeletons';
import { MobileNavBar } from 'components/nav-bars';

const ActivityChildrenPage = () => {
    const { t } = useTranslation('activity');
    const { parentActivityId } = useParams<{ parentActivityId: string }>();
    const { items, childItems, childHasMore, childParentActivityId } = useActivityStore(
        useShallow(s => ({
            items: s.items,
            childItems: s.childItems,
            childHasMore: s.childHasMore,
            childParentActivityId: s.childParentActivityId,
        })),
    );
    const { fetchSetChildActivity, fetchMoreChildActivity } = useActivityStore();
    const isLoading = useLoadingStore(selectActivityChildrenLoading);
    const isNextPageLoading = useLoadingStore(selectActivityChildrenNextPageLoading);

    const childCategory = useMemo(() => {
        const parentEvent = items.find(event => event.id === parentActivityId);

        return getActivityChildCategory(parentEvent);
    }, [items, parentActivityId]);

    const isCurrentParentLoaded = childParentActivityId === parentActivityId;
    const shouldShowSkeleton = isLoading || !isCurrentParentLoaded;
    const isEndOfFeed = !isNextPageLoading && !childHasMore && childItems.length > 0;
    const [sentinelRef, sentinelEntry] = useIntersectionObserver({ threshold: 0 });

    useEffect(() => {
        if (!parentActivityId || isCurrentParentLoaded) {
            return;
        }

        fetchSetChildActivity({ parentActivityId, category: childCategory });
    }, [parentActivityId, childCategory, isCurrentParentLoaded, fetchSetChildActivity]);

    useEffect(() => {
        if (sentinelEntry?.isIntersecting && childHasMore && !isNextPageLoading) {
            fetchMoreChildActivity();
        }
    }, [
        sentinelEntry?.isIntersecting,
        childHasMore,
        isNextPageLoading,
        fetchMoreChildActivity,
    ]);

    return (
        <Container size="2" pb={{ initial: '9', sm: '6' }}>
            <ActivityChildrenHeader isLoading={shouldShowSkeleton} />

            {shouldShowSkeleton ? (
                <ActivityFeedSkeleton />
            ) : (
                <ActivityEventsList
                    events={childItems}
                    emptyState={
                        <EmptyState
                            icon={<LucideListTree size={16} />}
                            iconColor="gray"
                            title={t('childEmptyTitle')}
                            description={t('childEmptyDescription')}
                        />
                    }
                >
                    <>
                        {isNextPageLoading && (
                            <Flex justify="center" py="4">
                                <Spinner size="3" />
                            </Flex>
                        )}

                        {isEndOfFeed && (
                            <Flex justify="center" align="center" gap="2" py="4">
                                <LucideChevronsDown size={14} color="var(--gray-8)" />
                                <Text size="1" color="gray">
                                    {t('endOfFeed')}
                                </Text>
                            </Flex>
                        )}

                        <div ref={sentinelRef} />
                    </>
                </ActivityEventsList>
            )}

            <MobileNavBar />
        </Container>
    );
};

export default ActivityChildrenPage;
```

- [ ] **Step 3: Register the route**

In `src/features/routing/AppRouter.tsx`, add this lazy import after `ActivityPage`:

```ts
const ActivityChildrenPage = lazy(() => import('pages/ActivityChildrenPage'));
```

Add this route immediately after the existing `ROUTES.ACTIVITY` route:

```tsx
                <Route
                    path={`${ROUTES.ACTIVITY}/:parentActivityId`}
                    element={
                        <ProtectedRoute>
                            <ActivityChildrenPage />
                        </ProtectedRoute>
                    }
                />
```

- [ ] **Step 4: Run typecheck for the new page and route**

Run: `npm run typecheck`

Expected: TypeScript completes without errors.

---

### Task 6: Make Expense And Settlement Cards Clickable

**Files:**
- Modify: `src/features/activity/components/EventRenderer.tsx`

- [ ] **Step 1: Add navigation imports**

In `src/features/activity/components/EventRenderer.tsx`, add:

```ts
import styled from 'styled-components';

import { buildActivityChildrenRoute } from 'constants/routes';

import { NavButton } from 'basics/buttons';
```

- [ ] **Step 2: Add a full-width unstyled nav wrapper**

In `src/features/activity/components/EventRenderer.tsx`, add this before `interface Props`:

```ts
const EventNavButton = styled(NavButton)`
    display: block;
    width: 100%;
`;
```

- [ ] **Step 3: Wrap only expense and settlement events**

In `src/features/activity/components/EventRenderer.tsx`, replace the two ledger cases with:

```tsx
        case ACTIVITY_ACTIONS.EXPENSE_CREATED:
            return (
                <EventNavButton to={buildActivityChildrenRoute(event.id)} unsetStyles>
                    <EventExpenseCreated event={event} />
                </EventNavButton>
            );
        case ACTIVITY_ACTIONS.SETTLEMENT_CREATED:
            return (
                <EventNavButton to={buildActivityChildrenRoute(event.id)} unsetStyles>
                    <EventSettlementCreated event={event} />
                </EventNavButton>
            );
```

Leave the group/member/unknown cases returning their current non-clickable components.

- [ ] **Step 4: Run typecheck for card navigation**

Run: `npm run typecheck`

Expected: TypeScript completes without errors.

---

### Task 7: Verify And Review

**Files:**
- Read: `src/api/chipin.ts`
- Read: `src/store/activityStore.ts`
- Read: `src/pages/ActivityChildrenPage.tsx`
- Read: `src/features/activity/components/EventRenderer.tsx`
- Read: `src/i18n/locales/en/activity.json`

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Expected: ESLint completes without errors.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: TypeScript completes without errors.

- [ ] **Step 3: Run full verification**

Run: `npm run verify`

Expected: lint, typecheck, PWA icon generation, version generation, and Vite build complete without errors.

- [ ] **Step 4: Manual behavior check in the running app**

Run: `npm run dev`

Expected: Vite prints a local URL, usually `http://localhost:5173/`.

Open the app and verify:

- Main activity page loads.
- Expense cards navigate to `/activity/<event-id>`.
- Settlement cards navigate to `/activity/<event-id>`.
- Group/member cards do not navigate.
- Child activity page shows skeleton while loading.
- Child activity page shows the activity list when the API returns items.
- Child activity page shows the child empty state when the API returns no items.
- Child activity pagination loads additional rows when scrolling to the bottom.
- A direct URL such as `/activity/<known-event-id>` loads without needing to visit the main feed first.

- [ ] **Step 5: Review scope before final response**

Confirm the implementation touched only the files named in this plan or files required by TypeScript import ordering. Confirm no production dependency was added. Confirm no backend contract was changed.
