import { LucideSettings, LucideUsers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import {
    AspectRatio,
    Avatar,
    Badge,
    Box,
    Flex,
    Heading,
    IconButton,
    Skeleton,
} from '@radix-ui/themes';

import { ApiGroup } from 'api/chipin.types';

import Image from 'basics/Image';
import GroupAvatar from 'components/GroupAvatar';
import { CreateUpdateGroupModal } from 'components/modals';

const CoverWrapper = styled(Box)`
    position: relative;
    overflow: hidden;
`;

const CoverGradient = styled(Box)`
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.72) 0%, transparent 55%);
    pointer-events: none;
`;

const CoverInfo = styled(Box)`
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
`;

interface Props {
    group: ApiGroup | null;
    isLoading: boolean;
    ratio?: number;
}

const GroupCoverSection = ({ group, isLoading, ratio = 16 / 5 }: Props) => {
    const { t } = useTranslation('group');

    return (
        <CoverWrapper>
            <AspectRatio ratio={ratio}>
                <Image
                    src={
                        group?.coverUrl ||
                        'https://www.virginaustralia.com/content/dam/vaa/images/destinations/bali/best-islands-near-bali/vaa-1440x620-best-islands-near-bali.jpg/jcr:content/renditions/vaacore.web.1920.0.jpg'
                    }
                    alt={`${group?.name} cover`}
                    width="100%"
                />
            </AspectRatio>
            <CoverGradient />

            <Box position="absolute" top="3" right="3">
                <CreateUpdateGroupModal type="update">
                    <IconButton
                        variant="solid"
                        color="blue"
                        size="2"
                        aria-label={t('modal.titleEdit')}
                    >
                        <LucideSettings size={16} />
                    </IconButton>
                </CreateUpdateGroupModal>
            </Box>

            <CoverInfo p="3">
                <Flex gap="2" align="center">
                    <Skeleton loading={isLoading}>
                        {group ? (
                            <GroupAvatar group={group} size="4" variant="solid" />
                        ) : (
                            <Avatar size="4" fallback={<LucideUsers />} />
                        )}
                    </Skeleton>
                    <Flex gap="1" direction="column">
                        <Box>
                            <Skeleton loading={isLoading}>
                                <Badge size="1" color="cyan" variant="surface">
                                    {group?.members.length ?? 0} {t('page.members')}
                                </Badge>
                            </Skeleton>
                        </Box>
                        <Box>
                            <Skeleton loading={isLoading}>
                                <Heading size="5">{group?.name || t('page.loadingGroup')}</Heading>
                            </Skeleton>
                        </Box>
                    </Flex>
                </Flex>
            </CoverInfo>
        </CoverWrapper>
    );
};

export default GroupCoverSection;
