import { useRef, useState } from 'react';
import { AmountInput } from 'basics';
import { LucideChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import styled from 'styled-components';

import { Avatar, Button, Card, Flex, Grid, Text, TextField } from '@radix-ui/themes';

import { ApiUser } from 'api/chipin.types';
import { EXPENSE_CATEGORIES, ExpenseCategory } from 'constants/chipin';
import { ROUTES } from 'constants/routes';
import { themeColor } from 'helpers/colors';
import { getUnixTimestampInSec } from 'helpers/time';
import { useActivityStore } from 'store/activityStore';
import { useGroupsStore } from 'store/groupsStore';
import { selectExpenseAdding } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import CurrencySelect from 'components/CurrencySelect';
import { CategorySearchSelect } from 'components/search-select';
import Select, { SelectItem } from 'components/Select';

import BaseModal from './BaseModal';

const EXPENSE_CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_CATEGORY = EXPENSE_CATEGORY_KEYS[0];

type ExpenseTab = 'group' | 'friends';

// font-size-8 (35 px, bold) has no equivalent TextField size prop — narrow exception.
const LargeAmountInput = styled(AmountInput)`
    box-shadow: none;

    & input {
        font-size: var(--font-size-8);
        font-weight: 700;
    }
`;

const TabButton = styled.button<{ $isActive: boolean }>`
    all: unset;
    flex: 1;
    text-align: center;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-5);
    font-size: var(--font-size-2);
    font-weight: 500;
    cursor: pointer;
    transition:
        background 120ms ease,
        color 120ms ease;
    background-color: ${({ $isActive }) => ($isActive ? themeColor('jade9') : 'transparent')};
    color: ${({ $isActive }) => ($isActive ? '#fff' : themeColor('gray11'))};
`;

const TabsWrapper = styled.div`
    display: flex;
    align-items: center;
    background-color: ${themeColor('gray3')};
    border-radius: var(--radius-5);
    padding: var(--space-1);
`;

interface Props {
    children: React.ReactNode;
    context?: 'friends';
}

const AddExpenseModal = ({ children, context }: Props) => {
    const { t } = useTranslation('group');
    const location = useLocation();
    const { user, friends } = useUsersStore();
    const { groups, selectedGroup } = useGroupsStore();
    const { createExpense } = useActivityStore();
    const isSubmitting = useLoadingStore(selectExpenseAdding);

    const isGroupRoute =
        location.pathname.startsWith(`${ROUTES.GROUP}/`) &&
        !location.pathname.startsWith(`${ROUTES.GROUP_JOIN}/`);
    const isGroupContext = isGroupRoute;
    const isFriendsContext = context === 'friends' || location.pathname === ROUTES.FRIENDS;
    const isShowTabs = !isGroupContext && !isFriendsContext;

    const defaultGroup = selectedGroup || groups[0];

    const getOrderedMembers = (groupMembers: ApiUser[]) => {
        const currentUserMember = groupMembers.find(member => member.id === user?.id);
        const otherMembers = groupMembers.filter(member => member.id !== user?.id);

        return currentUserMember ? [currentUserMember, ...otherMembers] : groupMembers;
    };

    const currencyWidthContainerRef = useRef<HTMLDivElement | null>(null);
    const [isModalOpened, setIsModalOpened] = useState(false);
    const [activeTab, setActiveTab] = useState<ExpenseTab>(isFriendsContext ? 'friends' : 'group');
    const [groupId, setGroupId] = useState(defaultGroup?.id || '');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
    const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
    const [paidById, setPaidById] = useState('');

    const selectedExpenseGroup = groups.find(group => group.id === groupId) || defaultGroup;
    const friendsMembers = user
        ? [user, ...friends.filter(friend => friend.id !== user.id)]
        : friends;
    const isFriendsTab = activeTab === 'friends';
    const groupMembers = selectedExpenseGroup?.members || [];
    const resolvedMembers = isFriendsTab ? friendsMembers : groupMembers;
    const orderedMembers = getOrderedMembers(resolvedMembers);

    const paidByMember = orderedMembers.find(member => member.id === paidById);

    const isShowGroupSelect = !isGroupContext && !isFriendsContext && activeTab === 'group';

    const groupItems: SelectItem[] = groups.map(group => {
        return {
            value: group.id,
            label: (
                <Flex gap="2" align="center">
                    <Text as="span">{group.emoji} </Text>
                    <Text as="span">{group.name}</Text>
                </Flex>
            ),
        };
    });
    const paidByItems: SelectItem[] = orderedMembers.map(member => {
        const isCurrentUser = member.id === user?.id;

        return {
            value: member.id,
            label: isCurrentUser ? t('expenses.modal.currentUser') : member.displayName,
        };
    });

    const getDefaultPayerId = (groupMembers: ApiUser[] = resolvedMembers) =>
        getOrderedMembers(groupMembers)[0]?.id || '';

    const getMembersByTab = (tab: ExpenseTab, nextGroupId: string) => {
        if (tab === 'friends') {
            return friendsMembers;
        }

        const nextGroup = groups.find(group => group.id === nextGroupId) || defaultGroup;

        return nextGroup?.members || [];
    };

    const resetForm = () => {
        const defaultTab = isFriendsContext ? 'friends' : 'group';
        const defaultGroupId = defaultGroup?.id || '';
        const defaultMembers = getMembersByTab(defaultTab, defaultGroupId);

        setActiveTab(defaultTab);
        setGroupId(defaultGroupId);
        setDescription('');
        setAmount('');
        setCurrency(DEFAULT_CURRENCY);
        setCategory(DEFAULT_CATEGORY);
        setPaidById(getDefaultPayerId(defaultMembers));
    };

    const onOpenChange = (isOpen: boolean) => {
        setIsModalOpened(isOpen);

        if (isOpen) {
            const defaultTab = isFriendsContext ? 'friends' : 'group';
            const defaultGroupId = defaultGroup?.id || '';
            const defaultMembers = getMembersByTab(defaultTab, defaultGroupId);

            setActiveTab(defaultTab);
            setGroupId(defaultGroupId);
            setPaidById(getDefaultPayerId(defaultMembers));
            return;
        }

        resetForm();
    };

    const onChangeGroup = (nextGroupId: string) => {
        const nextMembers = groups.find(group => group.id === nextGroupId)?.members || [];

        setGroupId(nextGroupId);
        setPaidById(getDefaultPayerId(nextMembers));
    };

    const onChangeTab = (nextTab: ExpenseTab) => {
        const nextMembers = getMembersByTab(nextTab, groupId);

        setActiveTab(nextTab);
        setPaidById(getDefaultPayerId(nextMembers));
    };

    const onAddExpense = () => {
        const params = {
            payerId: paidById,
            groupId: groupId,
            description: description,
            amount: amount,
            unixTimestamp: getUnixTimestampInSec(),
            participantIds: orderedMembers.map(member => member.id),
            currency: currency,
            category: category,
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
    const isSubmitDisabled =
        !description.trim() ||
        !isAmountValid ||
        !paidById ||
        (groups.length > 0 && !groupId) ||
        !resolvedMembers.length;

    return (
        <BaseModal
            isOpened={isModalOpened}
            setIsOpened={onOpenChange}
            triggerElement={children}
            title={t('expenses.modal.title')}
            maxWidth="460px"
            content={
                <Flex direction="column" gap="4">
                    {/* Amount + Currency */}
                    <Card ref={currencyWidthContainerRef}>
                        <Flex justify="between" align="center" gap="4">
                            <LargeAmountInput
                                value={amount}
                                onChange={setAmount}
                                color="gray"
                                size="3"
                            />

                            <CurrencySelect
                                onChange={setCurrency}
                                currency={currency}
                                contentWidthMode="parent"
                                triggerElement={
                                    <Button variant="outline" color="teal" size="2">
                                        {currency}
                                        <LucideChevronDown size={16} />
                                    </Button>
                                }
                                widthContainerRef={currencyWidthContainerRef}
                            />
                        </Flex>
                    </Card>

                    <Card>
                        <Grid columns="auto 1fr" gap="4" align="center">
                            {/* Category */}
                            <Text as="label" size="2" weight="medium" color="gray">
                                {t('common:fields.category')}
                            </Text>

                            <CategorySearchSelect value={category} onChange={setCategory} />

                            {/* Description */}
                            <Text as="label" size="2" weight="medium" color="gray">
                                {t('common:fields.description')}
                            </Text>

                            <TextField.Root
                                type="text"
                                size="3"
                                variant="surface"
                                placeholder={t('expenses.modal.fields.descriptionPlaceholder')}
                                value={description}
                                onChange={event => setDescription(event.target.value)}
                            />
                        </Grid>
                    </Card>

                    {isShowTabs && (
                        <Card>
                            {/* Group / Friends tabs — shown only from non-group, non-friends pages */}
                            <Flex direction="column" gap="4">
                                <TabsWrapper>
                                    <TabButton
                                        $isActive={activeTab === 'group'}
                                        onClick={() => onChangeTab('group')}
                                    >
                                        {t('expenses.modal.tabs.group')}
                                    </TabButton>

                                    <TabButton
                                        $isActive={activeTab === 'friends'}
                                        onClick={() => onChangeTab('friends')}
                                    >
                                        {t('expenses.modal.tabs.friends')}
                                    </TabButton>
                                </TabsWrapper>
                                {/* Group select — hidden when selectedGroup is set (group page) or in friends mode */}
                                {isShowGroupSelect && (
                                    <Flex direction="column" gap="2">
                                        <Select
                                            items={groupItems}
                                            value={groupId}
                                            onChange={onChangeGroup}
                                            size="3"
                                            triggerVariant="surface"
                                        />
                                    </Flex>
                                )}
                            </Flex>
                        </Card>
                    )}

                    <Card>
                        {/* Paid by */}
                        <Flex gap="4" align="center" justify="between">
                            <Text as="label" size="2" weight="bold" color="gray">
                                {t('common:fields.paidBy')}
                            </Text>

                            {orderedMembers.length > 0 ? (
                                <Select
                                    items={paidByItems}
                                    value={paidById}
                                    onChange={setPaidById}
                                    size="3"
                                    triggerVariant="surface"
                                    renderValue={item => {
                                        if (!item || !paidByMember) {
                                            return undefined;
                                        }

                                        return (
                                            <Flex align="center" gap="2">
                                                <Avatar
                                                    size="1"
                                                    radius="full"
                                                    src={paidByMember.picture || ''}
                                                    fallback={paidByMember.displayName
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                />
                                                <Text>
                                                    {paidByMember.id === user?.id
                                                        ? t('expenses.modal.currentUser')
                                                        : paidByMember.displayName}
                                                </Text>
                                            </Flex>
                                        );
                                    }}
                                    renderItem={item => {
                                        const member = orderedMembers.find(
                                            orderedMember => orderedMember.id === item.value,
                                        );

                                        if (!member) {
                                            return item.label;
                                        }

                                        return (
                                            <Flex align="center" gap="2" minWidth="0">
                                                <Avatar
                                                    size="1"
                                                    radius="full"
                                                    src={member.picture || ''}
                                                    fallback={member.displayName
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                />
                                                <Text truncate>{item.label}</Text>
                                            </Flex>
                                        );
                                    }}
                                />
                            ) : (
                                <Text size="2" color="gray">
                                    {t('expenses.modal.noMembers')}
                                </Text>
                            )}
                        </Flex>
                    </Card>

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
