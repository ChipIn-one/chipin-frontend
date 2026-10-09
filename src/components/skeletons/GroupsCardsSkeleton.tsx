import { LucidePlus, LucideSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    Avatar,
    Button,
    Card,
    Flex,
    IconButton,
    Skeleton,
    Text,
} from '@radix-ui/themes';

const SKELETON_COUNT = 3;

interface Props {
    label: string;
}

export const GroupsCardsSkeleton = ({ label }: Props) => {
    const { t: tDashboard } = useTranslation('dashboard');
    const { t: tSkeletons } = useTranslation('skeletons');

    return (
        <Flex direction="column" gap="3">
            <Flex align="center" justify="between" gap="2">
                <Text size="4" weight="bold">
                    <Skeleton>{label}</Skeleton>
                </Text>
                <Flex gap="3">
                    <Skeleton>
                        <IconButton>
                            <LucideSearch size={16} />
                        </IconButton>
                    </Skeleton>
                    <Skeleton>
                        <IconButton>
                            <LucidePlus size={16} />
                        </IconButton>
                    </Skeleton>
                </Flex>
            </Flex>

            <Flex gap="2" wrap="wrap">
                <Skeleton>
                    <Button size="2">{tDashboard('groups.filterAll')}</Button>
                </Skeleton>
                <Skeleton>
                    <Button size="2">{tDashboard('summary.owedToYou')}</Button>
                </Skeleton>
                <Skeleton>
                    <Button size="2">{tDashboard('summary.youOwe')}</Button>
                </Skeleton>
            </Flex>

            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <Card key={index} size="1">
                    <Flex gap="3" align="center" justify="between">
                        <Skeleton>
                            <Avatar size="4" fallback="•" />
                        </Skeleton>

                        <Flex direction="column" flexGrow="1" minWidth="0">
                            <Text size="3" weight="bold" as="span">
                                <Skeleton>{tSkeletons('groupsCards.groupName')}</Skeleton>
                            </Text>
                            <Text size="1" color="gray">
                                <Skeleton>{tSkeletons('groupsCards.members')}</Skeleton>
                            </Text>
                        </Flex>

                        <Text size="3" color="gray" weight="bold" as="span">
                            <Skeleton>{tSkeletons('groupsCards.groupBalance')}</Skeleton>
                        </Text>
                    </Flex>
                </Card>
            ))}
        </Flex>
    );
};
