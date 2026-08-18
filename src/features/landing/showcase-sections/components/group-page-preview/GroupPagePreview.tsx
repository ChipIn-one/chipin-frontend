import { Amount, BalanceSummaryText } from 'basics';
import { LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    Avatar,
    Badge,
    Box,
    Button,
    Card,
    Flex,
    Heading,
    IconButton,
    Separator,
    Tabs,
    Text,
} from '@radix-ui/themes';

import { OwedToYouCard } from 'components/summary-debt-cards';
import UsersRow from 'components/UsersRow';

import { LandingPreviewCard } from '../landing-preview-card';

import {
    GROUP_PREVIEW_COVER_URL,
    GROUP_PREVIEW_EXPENSES,
    GROUP_PREVIEW_MEMBERS,
    GROUP_PREVIEW_NET_BALANCE,
} from './internal';
import {
    PreviewCover,
    PreviewCoverImage,
    PreviewCoverScrim,
    PreviewDescription,
} from './styled';

const GroupPagePreview = () => {
    const { t } = useTranslation('landing');

    return (
        <LandingPreviewCard label={t('sections.groups.preview.label')}>
            <PreviewCover direction="column">
                <PreviewCoverImage
                    src={GROUP_PREVIEW_COVER_URL}
                    alt={t('sections.groups.preview.coverAlt')}
                    width="100%"
                    height="100%"
                />
                <PreviewCoverScrim aria-hidden />
                <Flex
                    direction="column"
                    gap="1"
                    align="start"
                    width="100%"
                    mt="auto"
                    px="5"
                    pb="5"
                    position="relative"
                >
                    <Badge size="1" color="gray" variant="solid">
                        {t('dashboard:groupsCard.members', {
                            count: GROUP_PREVIEW_MEMBERS.length,
                        })}
                    </Badge>
                    <Heading size="7">{t('sections.groups.preview.groupName')}</Heading>
                    <PreviewDescription size="2">
                        {t('sections.groups.preview.groupDescription')}
                    </PreviewDescription>
                </Flex>
            </PreviewCover>

            <Flex direction="column" gap="4" p="4">
                <OwedToYouCard
                    isLoading={false}
                    total={GROUP_PREVIEW_NET_BALANCE}
                    entries={[{ currency: 'EUR', netBalance: GROUP_PREVIEW_NET_BALANCE }]}
                    defaultCurrency="EUR"
                />

                <Flex align="center" justify="between" gap="3">
                    <Flex align="center" gap="2">
                        <UsersRow members={GROUP_PREVIEW_MEMBERS} max={5} size="2" />
                        <IconButton
                            size="2"
                            color="gray"
                            variant="outline"
                            radius="full"
                            aria-label={t('common:buttons.invitePeople')}
                        >
                            <LucidePlus size={18} />
                        </IconButton>
                    </Flex>
                    <Button size="2" variant="soft">
                        {t('common:buttons.settleUp')}
                    </Button>
                </Flex>

                <Tabs.Root value="expenses">
                    <Tabs.List size="2" mb="4">
                        <Tabs.Trigger value="expenses">
                            {t('group:page.tabs.expenses')}
                        </Tabs.Trigger>
                        <Tabs.Trigger value="balances">
                            {t('group:page.tabs.balances')}
                        </Tabs.Trigger>
                        <Tabs.Trigger value="settings">
                            {t('group:page.tabs.settings')}
                        </Tabs.Trigger>
                    </Tabs.List>

                    <Flex align="center" gap="3" py="2">
                        <Text size="1" color="gray" weight="medium" wrap="nowrap">
                            {t('activity:dateDivider.today')}
                        </Text>

                        <Box flexGrow="1">
                            <Separator size="4" />
                        </Box>

                        <BalanceSummaryText
                            entries={[
                                { currency: 'EUR', netBalance: GROUP_PREVIEW_NET_BALANCE },
                            ]}
                            size="1"
                            align="right"
                        />
                    </Flex>

                    <Flex
                        role="list"
                        aria-label={t('sections.groups.preview.expensesLabel')}
                        direction="column"
                        gap="2"
                    >
                        {GROUP_PREVIEW_EXPENSES.map(expense => {
                            const isOwed = expense.debt > 0;
                            const isCurrentUserPayer = expense.payer === 'you';
                            const ExpenseIcon = expense.icon;

                            return (
                                <Card key={expense.key} role="listitem" size="1">
                                    <Flex justify="between" align="center" gap="3">
                                        <Flex align="center" gap="3" minWidth="0">
                                            <Avatar
                                                size="2"
                                                color={isCurrentUserPayer ? 'green' : 'red'}
                                                fallback={
                                                    <ExpenseIcon
                                                        size={16}
                                                        aria-label={t(
                                                            `sections.groups.preview.expenses.${expense.key}`,
                                                        )}
                                                    />
                                                }
                                            />
                                            <Box minWidth="0">
                                                <Text size="3" weight="medium" as="p">
                                                    {t(
                                                        `sections.groups.preview.expenses.${expense.key}`,
                                                    )}
                                                </Text>
                                                <Text size="2" color="gray" as="p">
                                                    {t('activity:event.paidAmount', {
                                                        payer: isCurrentUserPayer
                                                            ? t('activity:event.you')
                                                            : expense.payer,
                                                    })}{' '}
                                                    <Amount
                                                        value={expense.amount}
                                                        tokenCode="EUR"
                                                        type="summary"
                                                    />
                                                </Text>
                                            </Box>
                                        </Flex>

                                        <Flex direction="column" align="end" flexShrink="0">
                                            <Text color={isOwed ? 'green' : 'red'} size="1">
                                                {t(
                                                    isOwed
                                                        ? 'activity:event.youLent'
                                                        : 'activity:event.youBorrowed',
                                                )}
                                            </Text>
                                            <Text
                                                color={isOwed ? 'green' : 'red'}
                                                size="2"
                                                weight="medium"
                                            >
                                                <Amount
                                                    value={Math.abs(expense.debt)}
                                                    tokenCode="EUR"
                                                    precision={0}
                                                    type="summary"
                                                />
                                            </Text>
                                        </Flex>
                                    </Flex>
                                </Card>
                            );
                        })}
                    </Flex>
                </Tabs.Root>
            </Flex>
        </LandingPreviewCard>
    );
};

export default GroupPagePreview;
