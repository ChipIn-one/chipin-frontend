import { useState } from 'react';
import { LucideCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Button, Flex, Grid, Select, Separator, Text, TextField } from '@radix-ui/themes';

import { ApiUser } from 'api/chipin.types';
import { EXPENSE_CATEGORIES, ExpenseCategory } from 'constants/chipin';
import { getUnixTimestampInSec } from 'helpers/time';
import { useActivityStore } from 'store/activityStore';
import { useGroupsStore } from 'store/groupsStore';
import { useUsersStore } from 'store/usersStore';

import BaseModal from './BaseModal';

const EXPENSE_CURRENCIES = [
    { value: 'USD', flag: '🇺🇸' },
    { value: 'EUR', flag: '🇪🇺' },
    { value: 'RUB', flag: '🇷🇺' },
] as const;

const EXPENSE_CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];

const DEFAULT_CURRENCY = EXPENSE_CURRENCIES[0].value;
const DEFAULT_CATEGORY = EXPENSE_CATEGORY_KEYS[0];

interface Props {
    children: React.ReactNode;
}

const AddExpenseModal = ({ children }: Props) => {
    const { t } = useTranslation();
    const { user } = useUsersStore();
    const { groups, selectedGroup } = useGroupsStore();
    const { createExpense } = useActivityStore();

    const defaultGroup = selectedGroup || groups[0];
    const getOrderedMembers = (groupMembers: ApiUser[]) => {
        const currentUserMember = groupMembers.find(member => member.id === user?.id);
        const otherMembers = groupMembers.filter(member => member.id !== user?.id);

        return currentUserMember ? [currentUserMember, ...otherMembers] : groupMembers;
    };

    const [isModalOpened, setIsModalOpened] = useState(false);
    const [groupId, setGroupId] = useState(defaultGroup?.id || '');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
    const [category, setCategory] = useState<ExpenseCategory>(DEFAULT_CATEGORY);
    const [paidById, setPaidById] = useState('');

    const selectedExpenseGroup = groups.find(group => group.id === groupId) || defaultGroup;
    const resolvedMembers = selectedExpenseGroup?.members || [];
    const orderedMembers = getOrderedMembers(resolvedMembers);

    const getDefaultPayerId = (groupMembers: ApiUser[] = resolvedMembers) =>
        getOrderedMembers(groupMembers)[0]?.id || '';

    const resetForm = () => {
        const defaultGroupId = defaultGroup?.id || '';
        const defaultMembers = groups.find(group => group.id === defaultGroupId)?.members || [];

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
            const defaultGroupId = defaultGroup?.id || '';
            const defaultMembers = groups.find(group => group.id === defaultGroupId)?.members || [];

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

    const onChangeCategory = (nextCategory: string) => {
        if (!Object.prototype.hasOwnProperty.call(EXPENSE_CATEGORIES, nextCategory)) {
            return;
        }

        setCategory(nextCategory as ExpenseCategory);
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
        };
        console.log(params);
        createExpense(params);
        onOpenChange(false);
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
            maxWidth="560px"
            content={
                <Flex direction="column" gap="5">
                    {groups.length > 1 && (
                        <Flex direction="column" gap="2">
                            <Text as="div" size="3" weight="medium">
                                {t('expenses.modal.fields.group')}
                            </Text>

                            <Select.Root value={groupId} onValueChange={onChangeGroup}>
                                <Select.Trigger />

                                <Select.Content>
                                    {groups.map(group => (
                                        <Select.Item key={group.id} value={group.id}>
                                            <Text as="span">{group.name}</Text>
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        </Flex>
                    )}

                    <Flex direction="column" gap="2">
                        <Text as="div" size="3" weight="medium">
                            {t('expenses.modal.fields.category')}
                        </Text>

                        <Grid columns={{ initial: '1', xs: '2' }} gap="3">
                            <Flex direction="column" gap="2">
                                <Text as="div" size="2" color="gray">
                                    {t('expenses.modal.fields.category')}
                                </Text>

                                <Select.Root value={category} onValueChange={onChangeCategory}>
                                    <Select.Trigger />

                                    <Select.Content>
                                        {EXPENSE_CATEGORY_KEYS.map(option => (
                                            <Select.Item key={option} value={option}>
                                                <Flex align="center" gap="2">
                                                    <Text as="span">
                                                        {EXPENSE_CATEGORIES[option].emoji}
                                                    </Text>
                                                    <Text as="span">
                                                        {t(`expenses.modal.categories.${option}`)}
                                                    </Text>
                                                </Flex>
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>
                            </Flex>

                            <Flex direction="column" gap="2">
                                <Text as="div" size="2" color="gray">
                                    {t('expenses.modal.fields.description')}
                                </Text>

                                <TextField.Root
                                    autoFocus
                                    size="3"
                                    variant="surface"
                                    placeholder={t('expenses.modal.fields.descriptionPlaceholder')}
                                    value={description}
                                    onChange={event => setDescription(event.target.value)}
                                />
                            </Flex>
                        </Grid>
                    </Flex>

                    <Flex direction="column" gap="2">
                        <Text as="div" size="3" weight="medium">
                            {t('expenses.modal.fields.amountAndCurrency')}
                        </Text>

                        <Grid columns={{ initial: '1', xs: '2' }} gap="3">
                            <Select.Root value={currency} onValueChange={setCurrency}>
                                <Select.Trigger />

                                <Select.Content>
                                    {EXPENSE_CURRENCIES.map(option => (
                                        <Select.Item key={option.value} value={option.value}>
                                            <Flex align="center" gap="2">
                                                <Text as="span">{option.flag}</Text>
                                                <Text as="span">{option.value}</Text>
                                            </Flex>
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>

                            <TextField.Root
                                size="3"
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                variant="surface"
                                placeholder={t('expenses.modal.fields.amountPlaceholder')}
                                value={amount}
                                onChange={event => setAmount(event.target.value)}
                            />
                        </Grid>
                    </Flex>

                    <Separator size="4" />

                    <Flex direction="column" gap="3">
                        <Text as="div" size="3" weight="medium">
                            {t('expenses.modal.fields.paidBy')}
                        </Text>

                        {orderedMembers.length > 0 ? (
                            <Flex wrap="wrap" gap="2">
                                {orderedMembers.map(member => {
                                    const isSelected = member.id === paidById;
                                    const isCurrentUser = member.id === user?.id;

                                    return (
                                        <Button
                                            key={member.id}
                                            size="2"
                                            radius="full"
                                            variant={isSelected ? 'solid' : 'soft'}
                                            color={isSelected ? 'jade' : 'gray'}
                                            onClick={() => setPaidById(member.id)}
                                        >
                                            <Avatar
                                                size="1"
                                                radius="full"
                                                src={member.picture || ''}
                                                fallback={member.displayName
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            />

                                            <Text weight="medium">
                                                {isCurrentUser
                                                    ? t('expenses.modal.currentUser')
                                                    : member.displayName}
                                            </Text>

                                            {isSelected ? (
                                                <LucideCheck size={16} />
                                            ) : (
                                                <span style={{ width: 16 }} />
                                            )}
                                        </Button>
                                    );
                                })}
                            </Flex>
                        ) : (
                            <Text size="2" color="gray">
                                {t('expenses.modal.noMembers')}
                            </Text>
                        )}

                        <Text size="2" color="gray">
                            {t('expenses.modal.splitHint')}
                        </Text>
                    </Flex>

                    <Flex justify="end" gap="3">
                        <Button
                            size="3"
                            variant="soft"
                            color="gray"
                            onClick={() => onOpenChange(false)}
                        >
                            {t('buttons.cancel')}
                        </Button>

                        <Button
                            size="3"
                            variant="solid"
                            disabled={isSubmitDisabled}
                            onClick={onAddExpense}
                        >
                            {t('expenses.modal.submit')}
                        </Button>
                    </Flex>
                </Flex>
            }
        />
    );
};

export default AddExpenseModal;
