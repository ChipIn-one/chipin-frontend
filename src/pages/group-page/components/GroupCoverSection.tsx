import { BackButton } from 'basics';
import { LucidePencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    Badge,
    Box,
    Flex,
    Heading,
    IconButton,
    Skeleton,
    Text,
} from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';

import { CreateUpdateGroupModal } from 'components/modals';

import { CoverGradient, CoverWrapper, GroupCoverImage } from './styled';

interface Props {
    group: Group | null;
    isLoading: boolean;
}

const GroupCoverSection = ({ group, isLoading }: Props) => {
    const { t } = useTranslation(['group', 'dashboard']);
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

            <Flex
                direction="column"
                gap="4"
                align="start"
                width="100%"
                mt="auto"
                px={{ initial: '4', sm: '5' }}
                pt="9"
                pb={{ initial: '4', sm: '5' }}
                position="relative"
            >
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
                        <Text color="gray" size={{ initial: '1', sm: '2' }}>
                            <Skeleton loading={isLoading}>
                                {group.description}
                            </Skeleton>
                        </Text>
                    ) : null}
                </Flex>
            </Flex>

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
                            variant="soft"
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
