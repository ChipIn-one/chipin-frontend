import { LucideReceiptText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import {
    Avatar,
    Box,
    Card,
    Flex,
    Grid,
    Separator,
    Skeleton,
    Switch,
    Text,
} from '@radix-ui/themes';

import {
    selectUserCurrency,
    selectUserDefaultCategory,
    selectUserSimplifyDebts,
    selectUserSkipCategory,
    useUsersStore,
} from 'store/users-store';

import CurrencySelect from 'components/CurrencySelect';
import { CategorySearchSelect } from 'components/search-select';

interface Props {
    isLoading: boolean;
}

const ExpensePreferencesSection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');
    const {
        defaultCurrency,
        defaultCategory,
        skipCategory,
        simplifyDebts,
        setUserSettings,
    } = useUsersStore(
        useShallow(state => ({
            defaultCurrency: selectUserCurrency(state),
            defaultCategory: selectUserDefaultCategory(state),
            skipCategory: selectUserSkipCategory(state),
            simplifyDebts: selectUserSimplifyDebts(state),
            setUserSettings: state.setUserSettings,
        })),
    );

    const onDefaultCurrencyChange = (value: string) => {
        setUserSettings({ settings: { defaultCurrency: value } });
    };

    const onDefaultCategoryChange = (value: string) => {
        setUserSettings({ settings: { defaultCategory: value } });
    };

    const onSkipCategoryChange = (isEnabled: boolean) => {
        setUserSettings({ settings: { skipCategory: isEnabled } });
    };

    const onSimplifyDebtsChange = (isEnabled: boolean) => {
        setUserSettings({ settings: { simplifyDebts: isEnabled } });
    };

    return (
        <Card size="3">
            <Flex direction="column" gap="4">
                <Flex align="center" gap="3">
                    <Skeleton loading={isLoading}>
                        <Avatar
                            variant="soft"
                            size="3"
                            color="mint"
                            fallback={<LucideReceiptText size={20} />}
                        />
                    </Skeleton>
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('expense.title')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('expense.description')}
                            </Skeleton>
                        </Text>
                    </Flex>
                </Flex>

                <Separator size="4" />

                <Box>
                    <Text weight="medium">
                        <Skeleton loading={isLoading}>
                            {t('common:fields.defaultCurrency')}
                        </Skeleton>
                    </Text>
                    <Box mt="2">
                        <CurrencySelect
                            currency={defaultCurrency}
                            isLoading={isLoading}
                            onChange={onDefaultCurrencyChange}
                        />
                    </Box>
                </Box>

                <Separator size="4" />

                <Grid columns={{ initial: '1', sm: '2' }} gap="4" align="end">
                    <Box>
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>
                                {t('expense.defaultCategoryTitle')}
                            </Skeleton>
                        </Text>
                        <Box mt="2">
                            <Skeleton loading={isLoading}>
                                <CategorySearchSelect
                                    value={defaultCategory}
                                    isDisabled={skipCategory}
                                    onChange={onDefaultCategoryChange}
                                />
                            </Skeleton>
                        </Box>
                    </Box>

                    <Flex justify="between" align="center" gap="3">
                        <Flex direction="column">
                            <Text weight="medium">{t('expense.skipCategoryTitle')}</Text>
                            <Text size="2" color="gray">
                                {t('expense.skipCategoryDescription')}
                            </Text>
                        </Flex>
                        <Skeleton loading={isLoading}>
                            <Switch
                                checked={skipCategory}
                                onCheckedChange={onSkipCategoryChange}
                                aria-label={t('expense.skipCategoryTitle')}
                            />
                        </Skeleton>
                    </Flex>
                </Grid>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="3">
                    <Flex direction="column">
                        <Text weight="medium">{t('expense.simplifyDebtsTitle')}</Text>
                        <Text size="2" color="gray">
                            {t('expense.simplifyDebtsDescription')}
                        </Text>
                    </Flex>
                    <Skeleton loading={isLoading}>
                        <Switch
                            checked={simplifyDebts}
                            onCheckedChange={onSimplifyDebtsChange}
                            aria-label={t('expense.simplifyDebtsTitle')}
                        />
                    </Skeleton>
                </Flex>
            </Flex>
        </Card>
    );
};

export default ExpensePreferencesSection;
