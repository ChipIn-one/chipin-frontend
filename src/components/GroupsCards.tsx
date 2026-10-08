import { type FocusEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
    LucideChevronDown,
    LucideChevronUp,
    LucideCircleCheck,
    LucideFilterX,
    LucidePlus,
    LucideSearch,
    LucideX,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    Button,
    Flex,
    IconButton,
    Separator,
    Text,
    TextField,
} from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';
import {
    GROUP_DEBT_FILTERS,
    type GroupDebtFilter,
} from 'constants/groups';

import { EmptyState } from 'basics/empty-states';
import { GroupCard } from './group-card';
import { useConnect } from './groups-cards/internal';
import {
    SearchButtonShell,
    SearchFieldShell,
    SearchIndicator,
    SettledToggleButton,
} from './groups-cards/styled';
import { CreateUpdateGroupModal } from './modals';
import { GroupsCardsSkeleton } from './skeletons';

interface Props {
    groups: Group[];
    label: string;
    selectedGroupId?: Group['id'];
}

const GroupsCards = ({ groups, label, selectedGroupId }: Props) => {
    const [activeFilter, setActiveFilter] = useState<GroupDebtFilter>(
        GROUP_DEBT_FILTERS.ALL,
    );
    const [isSettledVisible, setIsSettledVisible] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchButtonRef = useRef<HTMLButtonElement>(null);
    const shouldRestoreSearchButtonFocusRef = useRef(false);
    const { t } = useTranslation('dashboard');
    const {
        displayedGroups,
        hiddenSettledGroups,
        settledCount,
        isReady,
    } = useConnect({
        groups,
        filter: activeFilter,
        query: searchQuery,
        selectedGroupId,
    });
    const hasSearchQuery = searchQuery.trim().length > 0;
    const showSettledSection =
        activeFilter === GROUP_DEBT_FILTERS.ALL &&
        !hasSearchQuery &&
        settledCount > 0;
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

    return (
        <Flex direction="column" gap="3">
            <Flex align="center" justify="between" gap="2" minWidth="0">
                <Flex align="center" flexGrow="1" minWidth="0">
                    {isSearchOpen ? (
                        <SearchFieldShell width="100%" onBlur={onSearchBlur}>
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
                                    <LucideSearch size={16} />
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
                                            <LucideX size={14} />
                                        </IconButton>
                                    </TextField.Slot>
                                )}
                            </TextField.Root>
                        </SearchFieldShell>
                    ) : (
                        <Text size="4" weight="bold" truncate>
                            {label}
                        </Text>
                    )}
                </Flex>

                <Flex align="center" gap="3" flexShrink="0">
                    {!isSearchOpen && (
                        <SearchButtonShell>
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
                                <LucideSearch size={17} />
                            </IconButton>
                            {hasSearchQuery && <SearchIndicator aria-hidden />}
                        </SearchButtonShell>
                    )}
                    <CreateUpdateGroupModal type="create">
                        <IconButton
                            type="button"
                            size="2"
                            variant="soft"
                            aria-label={t('common:buttons.createGroup')}
                        >
                            <LucidePlus size={17} />
                        </IconButton>
                    </CreateUpdateGroupModal>
                </Flex>
            </Flex>

            <Flex gap="2" wrap="wrap" role="group" aria-label={t('groups.filtersLabel')}>
                {filterItems.map(item => (
                    <Button
                        key={item.value}
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
                    icon={<LucideFilterX size={16} />}
                    title={t('groups.filterEmptyTitle')}
                    description={emptyStateDescription}
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
                    <SettledToggleButton
                        type="button"
                        size="3"
                        variant="soft"
                        color="gray"
                        aria-expanded={isSettledVisible}
                        onClick={() =>
                            setIsSettledVisible(isVisible => !isVisible)
                        }
                    >
                        <Flex
                            align="center"
                            justify="between"
                            gap="3"
                            width="100%"
                            minWidth="0"
                        >
                            <Flex align="center" gap="2" minWidth="0">
                                <LucideCircleCheck size={16} />
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
                                    <LucideChevronUp size={18} />
                                ) : (
                                    <LucideChevronDown size={18} />
                                )}
                            </Flex>
                        </Flex>
                    </SettledToggleButton>

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

export default GroupsCards;
