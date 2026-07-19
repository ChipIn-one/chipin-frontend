import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { Button, Card, Flex, Grid, Text } from '@radix-ui/themes';

import type { SharingMode } from 'api/chipin.types';
import { EXPENSE_CATEGORIES, ExpenseCategory } from 'constants/chipin';
import { ROUTES } from 'constants/routes';
import { parseAmountInput } from 'helpers/numbers';
import { getUnixTimestampInSec } from 'helpers/time';
import { useActivityStore } from 'store/activityStore';
import { useGroupsStore } from 'store/groupsStore';
import { selectExpenseAdding } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import CurrencySelect from 'components/CurrencySelect';
import {
    ExpenseActionSelectTrigger,
    ExpenseGroupSearchSelect,
    ExpenseModalTopSection,
    ExpensePayerSearchSelect,
    ExpenseSplitModeControl,
    SplitParticipantsActions,
} from 'components/modals/add-expense';
import { CategorySearchSelect } from 'components/search-select';
import SegmentedControl from 'components/SegmentedControl';

import {
    ExpenseParticipant,
    ExpenseTargetMode,
    getDefaultFriendId,
    getFriendExpenseMembers,
    isValidDirectExpense,
} from './add-expense/expenseParticipants';
import type { SplitStatus } from './add-expense/ExpenseSplitModeControl';
import SplitAmountsSection from './components/SplitAmountsSection';
import SplitEqualSection from './components/SplitEqualSection';
import SplitPercentSection from './components/SplitPercentSection';
import SplitSharesSection from './components/SplitSharesSection';
import BaseModal from './BaseModal';
import { MODAL_SIZES } from './constants';

const EXPENSE_CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_CATEGORY = EXPENSE_CATEGORY_KEYS[0];

type SplitMode = 'equal' | 'percent' | 'amounts' | 'shares';

interface Props {
    children?: React.ReactNode;
    context?: 'friends';
    friendId?: string;
    isOpened?: boolean;
    setIsOpened?: (isOpen: boolean) => void;
}

const AddExpenseModal = ({
    children,
    context,
    friendId,
    isOpened: controlledIsOpened,
    setIsOpened: setControlledIsOpened,
}: Props) => {
    const { t } = useTranslation('group');
    const location = useLocation();
    const { user, friends } = useUsersStore(
        useShallow(s => ({
            user: s.user,
            friends: s.friends,
        })),
    );
    const { groups, selectedGroup } = useGroupsStore(
        useShallow(s => ({ groups: s.groups, selectedGroup: s.selectedGroup })),
    );
    const { createExpense } = useActivityStore();
    const isSubmitting = useLoadingStore(selectExpenseAdding);

    const isGroupRoute =
        location.pathname.startsWith(`${ROUTES.GROUP}/`) &&
        !location.pathname.startsWith(`${ROUTES.GROUP_JOIN}/`);
    const isGroupContext = isGroupRoute;
    const isFriendsContext = context === 'friends' || location.pathname === ROUTES.FRIENDS;
    const isShowTabs = !isGroupContext && !isFriendsContext;

    const defaultGroup = selectedGroup || groups[0];
    const knownFriends = friends.map(friend => friend.user);
    const getDefaultTargetMode = (): ExpenseTargetMode =>
        isFriendsContext || (!groups.length && knownFriends.length > 0) ? 'friends' : 'group';

    const getOrderedMembers = (groupMembers: ExpenseParticipant[]) => {
        const currentUserMember = groupMembers.find(member => member.id === user?.id);
        const otherMembers = groupMembers.filter(member => member.id !== user?.id);

        return currentUserMember ? [currentUserMember, ...otherMembers] : groupMembers;
    };

    const [internalIsModalOpened, setInternalIsModalOpened] = useState(false);
    const isModalOpened = controlledIsOpened ?? internalIsModalOpened;
    const [targetMode, setTargetMode] = useState<ExpenseTargetMode>(getDefaultTargetMode());
    const [groupId, setGroupId] = useState(defaultGroup?.id || '');
    const [selectedFriendId, setSelectedFriendId] = useState(
        getDefaultFriendId({ knownFriends, preferredFriendId: friendId }),
    );
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
    const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
    const [paidById, setPaidById] = useState('');
    const [splitMode, setSplitMode] = useState<SplitMode>('equal');
    const [percentShares, setPercentShares] = useState<Record<string, string>>({});
    const [amountShares, setAmountShares] = useState<Record<string, string>>({});
    const [shareWeights, setShareWeights] = useState<Record<string, string>>({});
    const [includedParticipantIds, setIncludedParticipantIds] = useState<Record<string, boolean>>(
        {},
    );
    const [isPercentManuallyEdited, setIsPercentManuallyEdited] = useState(false);
    const hasParticipantSelectionState = Object.keys(includedParticipantIds).length > 0;
    const initialFriendId = getDefaultFriendId({ knownFriends, preferredFriendId: friendId });
    const activeFriendId =
        targetMode === 'friends' && !selectedFriendId && !hasParticipantSelectionState
            ? initialFriendId
            : selectedFriendId;

    const buildEqualPercentShares = (members: ExpenseParticipant[]): Record<string, string> => {
        const count = members.length;
        if (count === 0) {
            return {};
        }
        const base = Math.floor(100 / count);
        const remainder = 100 - base * count;
        return Object.fromEntries(
            members.map((member, index) => [
                member.id,
                String(index === 0 ? base + remainder : base),
            ]),
        );
    };

    const buildEmptyAmountShares = (members: ExpenseParticipant[]): Record<string, string> => {
        return Object.fromEntries(members.map(member => [member.id, '0']));
    };

    const buildEqualShareWeights = (members: ExpenseParticipant[]): Record<string, string> => {
        return Object.fromEntries(members.map(member => [member.id, '1']));
    };

    const buildIncludedParticipantIds = (
        members: ExpenseParticipant[],
    ): Record<string, boolean> => {
        return Object.fromEntries(members.map(member => [member.id, true]));
    };

    const getIncludedMembers = (
        members: ExpenseParticipant[],
        includedIds: Record<string, boolean>,
        mode: ExpenseTargetMode = targetMode,
        nextFriendId: string = activeFriendId,
    ) => {
        const hasExplicitSelection = Object.keys(includedIds).length > 0;

        return members.filter(member => {
            if (mode === 'friends') {
                if (!hasExplicitSelection) {
                    return member.id === user?.id || member.id === nextFriendId;
                }

                return includedIds[member.id] === true;
            }

            return includedIds[member.id] !== false;
        });
    };

    const roundMoney = (value: number) => Math.round(value * 100) / 100;

    const getGroupMembersById = (nextGroupId: string) => {
        const nextGroup = groups.find(group => group.id === nextGroupId) || defaultGroup;

        return nextGroup?.members.map(member => member.user) || [];
    };

    const getMembersByTarget = (
        nextTargetMode: ExpenseTargetMode,
        nextGroupId: string,
        nextFriendId: string,
    ) => {
        if (nextTargetMode === 'friends') {
            return getFriendExpenseMembers({
                user,
                knownFriends,
                friendId: friendId ? nextFriendId : '',
            });
        }

        return getGroupMembersById(nextGroupId);
    };

    const resolvedMembers = getMembersByTarget(targetMode, groupId, activeFriendId);
    const orderedMembers = getOrderedMembers(resolvedMembers);
    const includedMembers = getIncludedMembers(
        orderedMembers,
        includedParticipantIds,
        targetMode,
        activeFriendId,
    );
    const includedMemberIds = new Set(includedMembers.map(member => member.id));

    const isDirectTarget = targetMode === 'friends';
    const isShowGroupSelect = !isGroupContext && !isFriendsContext && targetMode === 'group';
    const isShowParticipantControls =
        targetMode === 'group' || (targetMode === 'friends' && knownFriends.length > 0);

    // Step is rounded to the nearest unit based on total amount magnitude.
    const amountStep = Math.max(1, Math.round(Number(amount) / 100));

    const getDefaultPayerId = (groupMembers: ExpenseParticipant[] = resolvedMembers) =>
        getOrderedMembers(groupMembers)[0]?.id || '';

    const buildDefaultIncludedParticipantIds = (
        members: ExpenseParticipant[],
        nextTargetMode: ExpenseTargetMode,
        nextFriendId: string,
    ): Record<string, boolean> => {
        if (nextTargetMode === 'friends') {
            return Object.fromEntries(
                members.map(member => [
                    member.id,
                    member.id === user?.id || member.id === nextFriendId,
                ]),
            );
        }

        return buildIncludedParticipantIds(members);
    };

    const resetSplitStateForMembers = (
        members: ExpenseParticipant[],
        nextTargetMode: ExpenseTargetMode,
        nextFriendId: string,
    ) => {
        const orderedNextMembers = getOrderedMembers(members);
        const nextIncludedParticipantIds = buildDefaultIncludedParticipantIds(
            orderedNextMembers,
            nextTargetMode,
            nextFriendId,
        );
        const nextIncludedMembers = getIncludedMembers(
            orderedNextMembers,
            nextIncludedParticipantIds,
            nextTargetMode,
        );

        setPercentShares(buildEqualPercentShares(nextIncludedMembers));
        setAmountShares(buildEmptyAmountShares(orderedNextMembers));
        setShareWeights(buildEqualShareWeights(orderedNextMembers));
        setIncludedParticipantIds(nextIncludedParticipantIds);
        setIsPercentManuallyEdited(false);
    };

    const getDefaultPayerForTarget = (
        nextTargetMode: ExpenseTargetMode,
        members: ExpenseParticipant[],
    ) => {
        if (nextTargetMode === 'friends') {
            return user?.id || members[0]?.id || '';
        }

        return getDefaultPayerId(members);
    };

    const resetForm = () => {
        const defaultTargetMode = getDefaultTargetMode();
        const defaultGroupId = defaultGroup?.id || '';
        const defaultFriendId = getDefaultFriendId({ knownFriends, preferredFriendId: friendId });
        const defaultMembers = getMembersByTarget(
            defaultTargetMode,
            defaultGroupId,
            defaultFriendId,
        );

        setTargetMode(defaultTargetMode);
        setGroupId(defaultGroupId);
        setSelectedFriendId(defaultFriendId);
        setDescription('');
        setAmount('');
        setCurrency(DEFAULT_CURRENCY);
        setCategory(DEFAULT_CATEGORY);
        setPaidById(getDefaultPayerForTarget(defaultTargetMode, defaultMembers));
        setSplitMode('equal');
        resetSplitStateForMembers(defaultMembers, defaultTargetMode, defaultFriendId);
    };

    const onOpenChange = (isOpen: boolean) => {
        setInternalIsModalOpened(isOpen);
        setControlledIsOpened?.(isOpen);

        if (isOpen) {
            const defaultTargetMode = getDefaultTargetMode();
            const defaultGroupId = defaultGroup?.id || '';
            const defaultFriendId = getDefaultFriendId({
                knownFriends,
                preferredFriendId: friendId,
            });
            const defaultMembers = getMembersByTarget(
                defaultTargetMode,
                defaultGroupId,
                defaultFriendId,
            );

            setTargetMode(defaultTargetMode);
            setGroupId(defaultGroupId);
            setSelectedFriendId(defaultFriendId);
            setPaidById(getDefaultPayerForTarget(defaultTargetMode, defaultMembers));
            setSplitMode('equal');
            resetSplitStateForMembers(defaultMembers, defaultTargetMode, defaultFriendId);
            return;
        }

        resetForm();
    };

    const onChangeGroup = (nextGroupId: string) => {
        const nextMembers = getMembersByTarget('group', nextGroupId, selectedFriendId);

        setGroupId(nextGroupId);
        setPaidById(getDefaultPayerForTarget('group', nextMembers));
        resetSplitStateForMembers(nextMembers, 'group', selectedFriendId);
    };

    const onChangeTargetMode = (nextTargetMode: ExpenseTargetMode) => {
        const nextFriendId =
            selectedFriendId || getDefaultFriendId({ knownFriends, preferredFriendId: friendId });
        const nextMembers = getMembersByTarget(nextTargetMode, groupId, nextFriendId);

        setTargetMode(nextTargetMode);
        setSelectedFriendId(nextFriendId);
        setPaidById(getDefaultPayerForTarget(nextTargetMode, nextMembers));
        resetSplitStateForMembers(nextMembers, nextTargetMode, nextFriendId);
    };

    const handleSelectAllParticipants = () => {
        setIncludedParticipantIds(buildIncludedParticipantIds(orderedMembers));

        if (splitMode === 'percent' && !isPercentManuallyEdited) {
            setPercentShares(buildEqualPercentShares(orderedMembers));
        }
    };

    const handleDeselectAllParticipants = () => {
        setIncludedParticipantIds(
            Object.fromEntries(orderedMembers.map(member => [member.id, false])),
        );

        if (splitMode === 'percent' && !isPercentManuallyEdited) {
            setPercentShares({});
        }
    };

    const handleSplitModeChange = (nextSplitMode: SplitMode) => {
        setSplitMode(nextSplitMode);

        if (nextSplitMode === 'percent' && !isPercentManuallyEdited) {
            setPercentShares(buildEqualPercentShares(includedMembers));
        }
    };

    const handlePercentChange = (userId: string, delta: number) => {
        const current = Number(percentShares[userId]) || 0;
        const next = Math.max(0, current + delta);

        handlePercentInput(userId, String(next));
    };

    const handleAmountChange = (userId: string, delta: number) => {
        const current = Number(amountShares[userId]) || 0;
        const next = roundMoney(Math.max(0, current + delta));

        handleAmountInput(userId, next.toFixed(2));
    };

    const handleShareChange = (userId: string, delta: number) => {
        const current = Number(shareWeights[userId]) || 0;
        const next = Math.max(0, current + delta);

        handleShareInput(userId, String(next));
    };

    const handleIncludedChange = (userId: string, isIncluded: boolean) => {
        if (isDirectTarget) {
            if (userId === user?.id) {
                return;
            }

            const nextFriendId = isIncluded ? userId : '';
            const nextIncludedParticipantIds = Object.fromEntries(
                orderedMembers.map(member => [
                    member.id,
                    member.id === user?.id || (Boolean(nextFriendId) && member.id === nextFriendId),
                ]),
            );
            const nextIncludedMembers = getIncludedMembers(
                orderedMembers,
                nextIncludedParticipantIds,
                'friends',
            );

            setSelectedFriendId(nextFriendId);
            setIncludedParticipantIds(nextIncludedParticipantIds);
            setPaidById(prevPaidById =>
                nextIncludedParticipantIds[prevPaidById] ? prevPaidById : (user?.id ?? ''),
            );

            if (splitMode === 'percent' && !isPercentManuallyEdited) {
                setPercentShares(buildEqualPercentShares(nextIncludedMembers));
            }

            return;
        }

        setIncludedParticipantIds(prev => ({ ...prev, [userId]: isIncluded }));

        if (isIncluded) {
            setShareWeights(prev => ({
                ...prev,
                [userId]: prev[userId] ?? '1',
            }));
        }

        if (splitMode === 'percent' && !isPercentManuallyEdited) {
            const nextIncluded = orderedMembers.filter(member =>
                member.id === userId ? isIncluded : includedParticipantIds[member.id] !== false,
            );

            setPercentShares(buildEqualPercentShares(nextIncluded));
        }
    };

    const handlePercentInput = (userId: string, nextValue: string) => {
        if (/^\d{0,3}$/.test(nextValue)) {
            setIsPercentManuallyEdited(true);
            setPercentShares(prev => ({ ...prev, [userId]: nextValue }));
        }
    };

    const handleAmountInput = (userId: string, nextValue: string) => {
        const parsed = parseAmountInput(nextValue);

        if (parsed !== null) {
            setAmountShares(prev => ({ ...prev, [userId]: parsed }));
        }
    };

    const handleShareInput = (userId: string, nextValue: string) => {
        if (/^\d{0,4}$/.test(nextValue)) {
            setShareWeights(prev => ({ ...prev, [userId]: nextValue }));
        }
    };

    const buildSharingMode = (): SharingMode => {
        if (splitMode === 'percent') {
            return {
                type: 'PERCENTAGE',
                percentageShares: Object.fromEntries(
                    includedMembers.map(member => [
                        member.id,
                        Number(percentShares[member.id] ?? 0),
                    ]),
                ),
            };
        }
        if (splitMode === 'amounts') {
            return {
                type: 'EXACT',
                customShares: Object.fromEntries(
                    includedMembers.map(member => [member.id, Number(amountShares[member.id] ?? 0)]),
                ),
            };
        }
        if (splitMode === 'shares') {
            return {
                type: 'SHARES',
                shares: Object.fromEntries(
                    includedMembers.map(member => [member.id, Number(shareWeights[member.id] ?? 0)]),
                ),
            };
        }
        return { type: 'AUTO' };
    };

    const onAddExpense = () => {
        const participantIds = includedMembers.map(member => member.id);
        const params = {
            payerId: effectivePaidById,
            ...(targetMode === 'group' ? { groupId } : {}),
            description: description,
            amount: Number(amount),
            date: getUnixTimestampInSec(),
            participantIds,
            currency: currency,
            category: category,
            sharingMode: buildSharingMode(),
        };
        createExpense(params)
            .then(() => {
                onOpenChange(false);
                toast.success(t('toasts:expense.created'));
            })
            .catch(error => {
                toast.error(t('toasts:expense.createError'));
                console.error('Error creating expense:', error);
            });
    };

    const isAmountValid = Number(amount) > 0;

    const totalPercentShares = includedMembers.reduce(
        (acc, member) => acc + (Number(percentShares[member.id]) || 0),
        0,
    );
    const isPercentSplitValid = splitMode !== 'percent' || totalPercentShares === 100;

    const totalAmountShares = includedMembers.reduce((acc, member) => {
        return acc + (Number(amountShares[member.id]) || 0);
    }, 0);
    const isAmountSplitValid =
        splitMode !== 'amounts' || Math.abs(totalAmountShares - Number(amount)) < 0.001;
    const totalShareWeights = includedMembers.reduce((acc, member) => {
        return acc + (Number(shareWeights[member.id]) || 0);
    }, 0);
    const isShareSplitValid = splitMode !== 'shares' || totalShareWeights > 0;
    const totalExpenseAmount = Number(amount) || 0;
    const isDirectPairSelected =
        targetMode !== 'friends' ||
        (includedMembers.length === 2 && includedMemberIds.has(user?.id ?? ''));
    const assignedSplitAmount = (() => {
        if (!isDirectPairSelected) {
            return 0;
        }

        if (splitMode === 'equal') {
            return includedMembers.length > 0 ? totalExpenseAmount : 0;
        }
        if (splitMode === 'amounts') {
            return roundMoney(totalAmountShares);
        }
        if (splitMode === 'percent') {
            return roundMoney((totalExpenseAmount * totalPercentShares) / 100);
        }
        if (splitMode === 'shares') {
            return totalShareWeights > 0 ? totalExpenseAmount : 0;
        }
        return totalExpenseAmount;
    })();
    const splitStatus: SplitStatus =
        assignedSplitAmount === totalExpenseAmount
            ? 'exact'
            : assignedSplitAmount < totalExpenseAmount
              ? 'under'
              : 'over';
    const progressPercent =
        totalExpenseAmount > 0 ? (assignedSplitAmount / totalExpenseAmount) * 100 : 0;
    const currentUserId = user?.id;
    const yourShareAmount = (() => {
        if (!isDirectPairSelected) {
            return 0;
        }

        if (!currentUserId || !includedMemberIds.has(currentUserId)) {
            return 0;
        }

        if (splitMode === 'equal') {
            return includedMembers.length > 0
                ? roundMoney(totalExpenseAmount / includedMembers.length)
                : 0;
        }

        if (splitMode === 'percent') {
            return roundMoney(
                (totalExpenseAmount * (Number(percentShares[currentUserId]) || 0)) / 100,
            );
        }

        if (splitMode === 'amounts') {
            return roundMoney(Number(amountShares[currentUserId]) || 0);
        }

        if (splitMode === 'shares') {
            return totalShareWeights > 0
                ? roundMoney(
                      (totalExpenseAmount * (Number(shareWeights[currentUserId]) || 0)) /
                          totalShareWeights,
                  )
                : 0;
        }

        return 0;
    })();
    const splitMetrics = {
        splitStatus,
        progressPercent,
        yourShareAmount,
    };
    const participantIds = includedMembers.map(member => member.id);
    const payerMembers = targetMode === 'friends' ? includedMembers : orderedMembers;
    const effectivePaidById = payerMembers.some(member => member.id === paidById)
        ? paidById
        : getDefaultPayerForTarget(targetMode, payerMembers);
    const isDirectExpenseValid =
        targetMode !== 'friends' ||
        isValidDirectExpense({
            userId: user?.id,
            participantIds,
            payerId: effectivePaidById,
            knownFriends,
        });
    const includeParticipantLabel = (name: string) =>
        t('expenses.modal.split.includeParticipant', { name });
    const isParticipantLocked = (member: ExpenseParticipant) =>
        targetMode === 'friends' && (Boolean(friendId) || member.id === user?.id);
    const isParticipantIncluded = (member: ExpenseParticipant) =>
        targetMode === 'friends'
            ? hasParticipantSelectionState
                ? includedParticipantIds[member.id] === true
                : member.id === user?.id || member.id === activeFriendId
            : includedParticipantIds[member.id] !== false;

    const isSubmitDisabled =
        !description.trim() ||
        !isAmountValid ||
        !effectivePaidById ||
        (targetMode === 'group' && !groupId) ||
        (targetMode === 'friends' && !isDirectExpenseValid) ||
        !includedMembers.length ||
        !resolvedMembers.length ||
        !isPercentSplitValid ||
        !isAmountSplitValid ||
        !isShareSplitValid;

    return (
        <BaseModal
            isOpened={isModalOpened}
            setIsOpened={onOpenChange}
            triggerElement={children}
            title={t('expenses.modal.title')}
            maxWidth={MODAL_SIZES.desktop}
            content={
                <Flex direction="column" gap="4">
                    <ExpenseModalTopSection
                        amount={amount}
                        description={description}
                        amountLabel={t('common:fields.amount')}
                        descriptionPlaceholder={t('expenses.modal.fields.descriptionPlaceholder')}
                        onAmountChange={setAmount}
                        onDescriptionChange={setDescription}
                    />

                    <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                        <CategorySearchSelect
                            value={category}
                            renderTrigger={selectedCategory => (
                                <ExpenseActionSelectTrigger
                                    icon={selectedCategory?.icon}
                                    title={t('common:fields.category')}
                                    value={selectedCategory?.label ?? t('common:fields.category')}
                                />
                            )}
                            onChange={setCategory}
                        />

                        <CurrencySelect
                            onChange={setCurrency}
                            currency={currency}
                            triggerElement={
                                <ExpenseActionSelectTrigger
                                    title={t('common:fields.currency')}
                                    value={currency}
                                />
                            }
                        />
                    </Grid>

                    {isShowTabs && (
                        <Card>
                            {/* Group / Friends tabs — shown only from non-group, non-friends pages */}
                            <Flex direction="column" gap="4">
                                <SegmentedControl
                                    value={targetMode}
                                    items={[
                                        {
                                            value: 'group',
                                            label: t('expenses.modal.tabs.group'),
                                        },
                                        {
                                            value: 'friends',
                                            label: t('expenses.modal.tabs.friends'),
                                        },
                                    ]}
                                    onValueChange={value =>
                                        onChangeTargetMode(value as ExpenseTargetMode)
                                    }
                                />
                                {/* Group select — hidden when selectedGroup is set (group page) or in friends mode */}
                                {isShowGroupSelect && (
                                    <ExpenseGroupSearchSelect
                                        groups={groups}
                                        value={groupId}
                                        title={t('expenses.modal.fields.group')}
                                        searchPlaceholder={t(
                                            'expenses.modal.groupSearchPlaceholder',
                                        )}
                                        emptyText={t('expenses.modal.noGroups')}
                                        onChange={onChangeGroup}
                                    />
                                )}
                            </Flex>
                        </Card>
                    )}

                    {targetMode === 'friends' && knownFriends.length === 0 && (
                        <Text size="2" color="gray">
                            {t('expenses.modal.noKnownFriends')}
                        </Text>
                    )}

                    {isShowParticipantControls && orderedMembers.length > 0 ? (
                        <ExpensePayerSearchSelect
                            members={payerMembers}
                            value={effectivePaidById}
                            currentUserId={user?.id}
                            title={t('common:fields.paidBy')}
                            currentUserLabel={t('expenses.modal.currentUser')}
                            searchPlaceholder={t('expenses.modal.payerSearchPlaceholder')}
                            emptyText={t('expenses.modal.noMembers')}
                            onChange={setPaidById}
                        />
                    ) : targetMode === 'group' ? (
                        <Text size="2" color="gray">
                            {t('expenses.modal.noMembers')}
                        </Text>
                    ) : null}

                    {isShowParticipantControls && (
                        <Card>
                            <Flex direction="column" gap="4">
                                <ExpenseSplitModeControl
                                    title={t('expenses.modal.split.title')}
                                    totalLabel={t('expenses.modal.split.total')}
                                    assignedAmount={assignedSplitAmount}
                                    totalAmount={totalExpenseAmount}
                                    currency={currency}
                                    status={splitMetrics.splitStatus}
                                    progressPercent={splitMetrics.progressPercent}
                                    value={splitMode}
                                    onValueChange={value =>
                                        handleSplitModeChange(value as SplitMode)
                                    }
                                    items={[
                                        {
                                            value: 'equal',
                                            label: t('expenses.modal.split.equal'),
                                        },
                                        {
                                            value: 'percent',
                                            label: t('expenses.modal.split.percent'),
                                        },
                                        {
                                            value: 'amounts',
                                            label: t('expenses.modal.split.amounts'),
                                        },
                                        {
                                            value: 'shares',
                                            label: t('expenses.modal.split.shares'),
                                        },
                                    ]}
                                />

                                {orderedMembers.length > 0 && (
                                    <SplitParticipantsActions
                                        selectAllLabel={t('expenses.modal.split.selectAll')}
                                        deselectAllLabel={t('expenses.modal.split.deselectAll')}
                                        isAllSelected={orderedMembers.every(
                                            member => includedParticipantIds[member.id] !== false,
                                        )}
                                        isToggleHidden={targetMode !== 'group'}
                                        yourShareLabel={t('expenses.modal.split.yourShare')}
                                        yourShareAmount={splitMetrics.yourShareAmount}
                                        currency={currency}
                                        onToggleAll={() => {
                                            const isAllSelected = orderedMembers.every(
                                                member =>
                                                    includedParticipantIds[member.id] !== false,
                                            );

                                            if (isAllSelected) {
                                                handleDeselectAllParticipants();
                                                return;
                                            }

                                            handleSelectAllParticipants();
                                        }}
                                    />
                                )}

                                {splitMode === 'equal' && (
                                    <SplitEqualSection
                                        members={orderedMembers}
                                        includedParticipantIds={includedParticipantIds}
                                        includeParticipantLabel={includeParticipantLabel}
                                        onIncludedChange={handleIncludedChange}
                                        isParticipantLocked={isParticipantLocked}
                                        isParticipantIncluded={isParticipantIncluded}
                                        totalAmount={amount}
                                        currency={currency}
                                        yourShareAmount={splitMetrics.yourShareAmount}
                                        isSummaryHidden
                                    />
                                )}

                                {splitMode === 'percent' && (
                                    <SplitPercentSection
                                        members={orderedMembers}
                                        includedParticipantIds={includedParticipantIds}
                                        includeParticipantLabel={includeParticipantLabel}
                                        onIncludedChange={handleIncludedChange}
                                        isParticipantLocked={isParticipantLocked}
                                        isParticipantIncluded={isParticipantIncluded}
                                        percentShares={percentShares}
                                        onChangePercent={handlePercentChange}
                                        onPercentInput={handlePercentInput}
                                        currency={currency}
                                        yourShareAmount={splitMetrics.yourShareAmount}
                                        isSummaryHidden
                                    />
                                )}

                                {splitMode === 'amounts' && (
                                    <SplitAmountsSection
                                        members={orderedMembers}
                                        includedParticipantIds={includedParticipantIds}
                                        includeParticipantLabel={includeParticipantLabel}
                                        onIncludedChange={handleIncludedChange}
                                        isParticipantLocked={isParticipantLocked}
                                        isParticipantIncluded={isParticipantIncluded}
                                        amountShares={amountShares}
                                        onChangeAmount={handleAmountChange}
                                        onAmountInput={handleAmountInput}
                                        currency={currency}
                                        step={amountStep}
                                        yourShareAmount={splitMetrics.yourShareAmount}
                                        isSummaryHidden
                                    />
                                )}

                                {splitMode === 'shares' && (
                                    <SplitSharesSection
                                        members={orderedMembers}
                                        includedParticipantIds={includedParticipantIds}
                                        includeParticipantLabel={includeParticipantLabel}
                                        onIncludedChange={handleIncludedChange}
                                        isParticipantLocked={isParticipantLocked}
                                        isParticipantIncluded={isParticipantIncluded}
                                        shares={shareWeights}
                                        onChangeShare={handleShareChange}
                                        onShareInput={handleShareInput}
                                        currency={currency}
                                        yourShareAmount={splitMetrics.yourShareAmount}
                                        isSummaryHidden
                                    />
                                )}
                            </Flex>
                        </Card>
                    )}

                    <Flex justify="end" gap="3">
                        <Button
                            size="3"
                            variant="soft"
                            color="gray"
                            onClick={() => onOpenChange(false)}
                        >
                            {t('common:buttons.cancel')}
                        </Button>

                        <Button
                            size="3"
                            variant="solid"
                            disabled={isSubmitDisabled}
                            loading={isSubmitting}
                            onClick={onAddExpense}
                        >
                            {t('common:buttons.addExpense')}
                        </Button>
                    </Flex>
                </Flex>
            }
        />
    );
};

export default AddExpenseModal;
