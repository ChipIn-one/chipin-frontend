import { type FocusEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Flex, IconButton, Separator, Text, TextField } from '@radix-ui/themes';
import {
    ChevronDownIcon,
    ChevronUpIcon,
    CircleCheckIcon,
    FilterXIcon,
    PlusIcon,
    SearchIcon,
    XIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { GROUP_DEBT_FILTERS, type GroupDebtFilter } from 'constants/groups';
import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import { legacyRatesFromDecimals } from 'entities/balance';
import { EMPTY_CURRENCY_RATES, useCurrencyRatesQuery } from 'entities/currency-rates';
import type { Group } from 'entities/groups';
import { userCurrency } from 'entities/users';
import { getUnixTimestampInSec } from 'helpers/time';
import { useGroupsList } from 'hooks/useGroupsList';
import { useUserSetting } from 'hooks/useSelfUser';
import { selectGroupsCardsView } from 'store/groupsSelectors';

import { EmptyState } from 'basics/empty-states';
import { OnlineOnly } from 'components/online-only';

import { GroupCard } from './group-card';
import { CreateUpdateGroupModal } from './modals';
import { GroupsCardsSkeleton } from './skeletons';

import styles from './GroupsCards.module.css';

interface Props {
    groups: Group[];
    label: string;
    selectedGroupId?: Group['id'];
}

const GroupsCards = ({ groups, label, selectedGroupId }: Props) => {
    const [activeFilter, setActiveFilter] = useState<GroupDebtFilter>(GROUP_DEBT_FILTERS.ALL);
    const [isSettledVisible, setIsSettledVisible] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchButtonRef = useRef<HTMLButtonElement>(null);
    const allFilterButtonRef = useRef<HTMLButtonElement>(null);
    const shouldRestoreSearchButtonFocusRef = useRef(false);
    const { t } = useTranslation(['dashboard', 'activity']);
    const [nowTimestamp] = useState(() => getUnixTimestampInSec());
    // The list has data, or its first load has settled (a failed one included).
    const { isLoading: isGroupListLoading } = useGroupsList();
    const defaultCurrency = useUserSetting(userCurrency);
    const { data: currencyRates = EMPTY_CURRENCY_RATES, isLoading: isRatesLoading } =
        useCurrencyRatesQuery();
    // The cards convert group balances with the rates: wait for their first load (failed or
    // paused offline counts as done), as for the list.
    const isReady = !isGroupListLoading && !isRatesLoading;
    const rates = useMemo(() => legacyRatesFromDecimals(currencyRates.rates), [currencyRates]);
    const { displayedGroups, hiddenSettledGroups, settledCount } = selectGroupsCardsView(groups, {
        filter: activeFilter,
        query: searchQuery,
        selectedGroupId,
        rates,
        baseCurrency: currencyRates.base,
        defaultCurrency,
        nowTimestamp,
    });
    const hasSearchQuery = searchQuery.trim().length > 0;
    const showSettledSection =
        activeFilter === GROUP_DEBT_FILTERS.ALL && !hasSearchQuery && settledCount > 0;
    const showEmptyState = displayedGroups.length === 0 && !showSettledSection;
    const searchButtonLabel = hasSearchQuery
        ? t('groups.searchActiveLabel', { query: searchQuery.trim() })
        : t('groups.searchLabel');
    const emptyStateDescription = hasSearchQuery
        ? t('groups.searchEmptyDescription')
        : t('groups.filterEmptyDescription');

    useEffect(() => {
        if (!isSearchOpen && shouldRestoreSearchButtonFocusRef.current) {
            shouldRestoreSearchButtonFocusRef.current = false;
            searchButtonRef.current?.focus();
        }
    }, [isSearchOpen]);

    if (!isReady) {
        return <GroupsCardsSkeleton label={label} />;
    }

    const filterItems: { value: GroupDebtFilter; label: string }[] = [
        { value: GROUP_DEBT_FILTERS.ALL, label: t('groups.filterAll') },
        { value: GROUP_DEBT_FILTERS.OWED, label: t('summary.owedToYou') },
        { value: GROUP_DEBT_FILTERS.OWES, label: t('summary.youOwe') },
    ];

    const onSearchBlur = (event: FocusEvent<HTMLDivElement>) => {
        const nextFocusedElement = event.relatedTarget;

        if (
            nextFocusedElement instanceof Node &&
            event.currentTarget.contains(nextFocusedElement)
        ) {
            return;
        }

        setIsSearchOpen(false);
    };

    const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            shouldRestoreSearchButtonFocusRef.current = true;
            setIsSearchOpen(false);
        }
    };

    const onClearSearch = () => {
        searchInputRef.current?.focus();
        setSearchQuery('');
    };

    // `Show all` of an empty result (DSH-006): the All filter and no query. The action unmounts with
    // the empty state, so focus moves to the All filter instead of falling back to the page.
    const onShowAll = () => {
        setActiveFilter(GROUP_DEBT_FILTERS.ALL);
        setSearchQuery('');
        allFilterButtonRef.current?.focus();
    };

    return (
        <Flex direction="column" gap="3">
            <Flex align="center" justify="between" gap="2" minWidth="0">
                <Flex align="center" flexGrow="1" minWidth="0">
                    {isSearchOpen ? (
                        <Box
                            className={styles.searchField}
                            width="100%"
                            minWidth="0"
                            onBlur={onSearchBlur}
                        >
                            <TextField.Root
                                ref={searchInputRef}
                                autoFocus
                                value={searchQuery}
                                onChange={event => setSearchQuery(event.target.value)}
                                onKeyDown={onSearchKeyDown}
                                placeholder={t('groups.searchPlaceholder')}
                                aria-label={t('groups.searchLabel')}
                                size="2"
                            >
                                <TextField.Slot side="left">
                                    <SearchIcon size={16} />
                                </TextField.Slot>
                                {hasSearchQuery && (
                                    <TextField.Slot side="right">
                                        <IconButton
                                            type="button"
                                            size="1"
                                            variant="ghost"
                                            color="gray"
                                            aria-label={t('groups.clearSearch')}
                                            onMouseDown={event => event.preventDefault()}
                                            onClick={onClearSearch}
                                        >
                                            <XIcon size={14} />
                                        </IconButton>
                                    </TextField.Slot>
                                )}
                            </TextField.Root>
                        </Box>
                    ) : (
                        <Text size="3" weight="bold" truncate>
                            {label}
                        </Text>
                    )}
                </Flex>

                <Flex align="center" gap="3" flexShrink="0">
                    {!isSearchOpen && (
                        <Flex as="span" display="inline-flex" position="relative">
                            <IconButton
                                ref={searchButtonRef}
                                type="button"
                                size="2"
                                variant="soft"
                                color="gray"
                                aria-label={searchButtonLabel}
                                data-query-active={hasSearchQuery || undefined}
                                onClick={() => setIsSearchOpen(true)}
                            >
                                <SearchIcon size={17} />
                            </IconButton>
                            {hasSearchQuery && (
                                <span className={styles.searchIndicator} aria-hidden />
                            )}
                        </Flex>
                    )}
                    <CreateUpdateGroupModal type="create">
                        <OnlineOnly action={ONLINE_ONLY_ACTIONS.groupCreate}>
                            <IconButton
                                type="button"
                                size="2"
                                variant="soft"
                                aria-label={t('common:buttons.createGroup')}
                            >
                                <PlusIcon size={17} />
                            </IconButton>
                        </OnlineOnly>
                    </CreateUpdateGroupModal>
                </Flex>
            </Flex>

            <Flex gap="2" wrap="wrap" role="group" aria-label={t('groups.filtersLabel')}>
                {filterItems.map(item => (
                    <Button
                        key={item.value}
                        ref={item.value === GROUP_DEBT_FILTERS.ALL ? allFilterButtonRef : undefined}
                        size="3"
                        variant="soft"
                        color={activeFilter === item.value ? 'grass' : 'gray'}
                        aria-pressed={activeFilter === item.value}
                        onClick={() => setActiveFilter(item.value)}
                    >
                        {item.label}
                    </Button>
                ))}
            </Flex>

            {showEmptyState && (
                <EmptyState
                    icon={<FilterXIcon size={16} />}
                    title={t('groups.filterEmptyTitle')}
                    description={emptyStateDescription}
                    action={
                        <Button type="button" variant="soft" onClick={onShowAll}>
                            {t('activity:showAllAction')}
                        </Button>
                    }
                />
            )}

            {displayedGroups.map(model => (
                <GroupCard
                    key={model.group.id}
                    model={model}
                    isSelected={model.group.id === selectedGroupId}
                />
            ))}

            {showSettledSection && (
                <Flex direction="column" gap="3" mt="1">
                    <Separator size="4" />
                    <Text size="1" color="gray" align="center">
                        {t('groups.settledAutoHide')}
                    </Text>
                    <Button
                        className={styles.settledToggle}
                        type="button"
                        size="3"
                        variant="soft"
                        color="gray"
                        aria-expanded={isSettledVisible}
                        onClick={() => setIsSettledVisible(isVisible => !isVisible)}
                    >
                        <Flex align="center" justify="between" gap="3" width="100%" minWidth="0">
                            <Flex align="center" gap="2" minWidth="0">
                                <CircleCheckIcon size={16} />
                                <Text size="2" weight="medium" truncate>
                                    {t('groups.settledCount', {
                                        count: settledCount,
                                    })}
                                </Text>
                            </Flex>
                            <Flex align="center" gap="1" flexShrink="0">
                                <Text size="2">
                                    {isSettledVisible
                                        ? t('groups.hideSettled')
                                        : t('groups.showSettled')}
                                </Text>
                                {isSettledVisible ? (
                                    <ChevronUpIcon size={18} />
                                ) : (
                                    <ChevronDownIcon size={18} />
                                )}
                            </Flex>
                        </Flex>
                    </Button>

                    {isSettledVisible &&
                        hiddenSettledGroups.map(model => (
                            <GroupCard
                                key={model.group.id}
                                model={model}
                                isSelected={model.group.id === selectedGroupId}
                            />
                        ))}
                </Flex>
            )}
        </Flex>
    );
};

export { GroupsCards };
