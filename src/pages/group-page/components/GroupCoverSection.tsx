import { BackButton } from 'basics';
import {
    LucidePencil,
    LucidePlus,
    LucideUsers,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    Avatar,
    Badge,
    Box,
    Button,
    Flex,
    Grid,
    Heading,
    IconButton,
    Skeleton,
    Text,
} from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';
import { useExpenseModalStore } from 'store/expenseModalStore';

import GroupAvatar from 'components/GroupAvatar';
import { CreateUpdateGroupModal, SettleUpModal } from 'components/modals';
import UsersRow from 'components/UsersRow';

import { CoverGradient, CoverWrapper, GroupCoverImage } from './styled';

interface Props {
    group: Group | null;
    isLoading: boolean;
}

const GroupCoverSection = ({ group, isLoading }: Props) => {
    const { t } = useTranslation(['group', 'common', 'dashboard']);
    const openAddExpenseModal = useExpenseModalStore(state => state.open);
    const members = group?.members ?? [];

    return (
        <CoverWrapper
            $hasCover={Boolean(group?.coverUrl)}
            direction="column"
            position="relative"
        >
            <GroupCoverImage
                src={group?.coverUrl ?? undefined}
                alt={t('page.coverAlt', { name: group?.name ?? '' })}
                width="100%"
                height="100%"
            />
            {group?.coverUrl ? <CoverGradient aria-hidden /> : null}

            <Grid
                columns={{ initial: '1', sm: '2' }}
                gap="4"
                align="end"
                width="100%"
                mt="auto"
                px={{ initial: '4', sm: '5' }}
                pt="9"
                pb={{ initial: '4', sm: '5' }}
                position="relative"
            >
                <Flex
                    direction="column"
                    gap="3"
                    gridColumn={{ initial: 'auto', sm: '1 / -1' }}
                >
                    <Flex gap="3" align="center">
                        <Skeleton loading={isLoading}>
                            {group ? (
                                <GroupAvatar
                                    group={group}
                                    size="6"
                                    variant="solid"
                                    
                                />
                            ) : (
                                <Avatar size="5" fallback={<LucideUsers />} />
                            )}
                        </Skeleton>
                        <Flex gap="1" direction="column" align="start">
                            <Skeleton loading={isLoading}>
                                <Badge size="1" color="gray" variant="solid">
                                    {t('dashboard:groupsCard.members', {
                                        count: members.length,
                                    })}
                                </Badge>
                            </Skeleton>
                            <Heading size={{ initial: '5', sm: '7' }}>
                                <Skeleton loading={isLoading}>
                                    {group?.name || t('page.loadingGroup')}
                                </Skeleton>
                            </Heading>
                            {group?.description ? (
                        <Text color='gray' size={{ initial: '1', sm: '2' }}>
                            <Skeleton loading={isLoading}>
                                {group.description}
                            </Skeleton>
                        </Text>
                    ) : null}
                        </Flex>
                    </Flex>

                    
                </Flex>

                <Flex align="center" gap="2">
                    <UsersRow
                        members={members.map(member => member.user)}
                        max={10}
                        size="2"
                    />
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

                {group ? (
                    <Flex
                        align={{ initial: 'stretch', sm: 'center' }}
                        justify='end'
                        gap="2"
                    >
                        <Button
                            variant="outline"
                            color="green"
                            size="2"
                            disabled={members.length === 0}
                            onClick={() => openAddExpenseModal()}
                        >
                            <LucidePlus size={15} />
                            {t('common:buttons.addExpense')}
                        </Button>
                        <SettleUpModal source="group" group={group} />
                    </Flex>
                ) : null}
            </Grid>

            <Flex
                position="absolute"
                top="3"
                right="3"
                left="3"
                justify="between"
            >
                <Box display={{ initial: 'block', sm: 'none' }}>
                    <BackButton />
                </Box>

                <Box ml="auto">
                    <CreateUpdateGroupModal type="update">
                        <IconButton
                            variant="surface"
                            color="gray"
                            size="2"
                            aria-label={t('modal.titleEdit')}
                        >
                            <LucidePencil size={16} />
                        </IconButton>
                    </CreateUpdateGroupModal>
                </Box>
            </Flex>
        </CoverWrapper>
    );
};

export default GroupCoverSection;
