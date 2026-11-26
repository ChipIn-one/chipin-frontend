import { Badge, Box, Flex, Heading, IconButton, Skeleton, Text } from '@radix-ui/themes';
import { PencilIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { GROUP_COVER_OBJECT_POSITION, GROUP_COVER_RATIO } from 'constants/groupCover';
import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import type { Group } from 'entities/groups';

import { BackButton } from 'basics';
import { Image } from 'basics/Image';
import { CreateUpdateGroupModal } from 'components/modals/create-update-group-modal';
import { OnlineOnly } from 'components/online-only';

import styles from './GroupCoverSection.module.css';

// The cover constants are shared with other covers, so they reach the module as local custom properties.
const COVER_STYLE: CSSProperties & Record<'--_cover-ratio' | '--_cover-position', string> = {
    '--_cover-ratio': String(GROUP_COVER_RATIO),
    '--_cover-position': GROUP_COVER_OBJECT_POSITION,
};

interface Props {
    group: Group | null;
    isLoading: boolean;
}

const GroupCoverSection = ({ group, isLoading }: Props) => {
    const { t } = useTranslation(['group', 'dashboard']);
    const members = group?.members ?? [];

    return (
        <Flex
            className={styles.root}
            style={COVER_STYLE}
            data-has-cover={Boolean(group?.coverUrl)}
            direction="column"
            position="relative"
        >
            {/* No group yet: a skeleton, not the "No image" fallback. */}
            {isLoading && !group ? (
                <Skeleton className={styles.image} width="100%" height="100%" />
            ) : (
                <Image
                    className={styles.image}
                    src={group?.coverUrl ?? undefined}
                    alt={t('page.coverAlt', { name: group?.name ?? '' })}
                    width="100%"
                    height="100%"
                />
            )}
            {group?.coverUrl ? <Box className={styles.gradient} aria-hidden /> : null}

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
                            <Skeleton loading={isLoading}>{group.description}</Skeleton>
                        </Text>
                    ) : null}
                </Flex>
            </Flex>

            <Flex position="absolute" top="3" right="3" left="3" justify="between">
                <Box display={{ initial: 'block', sm: 'none' }}>
                    <BackButton />
                </Box>

                {group && (
                    <Box ml="auto">
                        <CreateUpdateGroupModal type="update" group={group}>
                            <OnlineOnly action={ONLINE_ONLY_ACTIONS.groupUpdate}>
                                <IconButton
                                    variant="solid"
                                    color="gray"
                                    size="2"
                                    aria-label={t('modal.titleEdit')}
                                >
                                    <PencilIcon size={16} />
                                </IconButton>
                            </OnlineOnly>
                        </CreateUpdateGroupModal>
                    </Box>
                )}
            </Flex>
        </Flex>
    );
};

export { GroupCoverSection };
