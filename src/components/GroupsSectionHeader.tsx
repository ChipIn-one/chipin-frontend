import { LucidePlus, LucideUsers } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, Button, Flex, Skeleton, Text } from '@radix-ui/themes';

import { CreateUpdateGroupModal } from './Modal';

type Props = Omit<ComponentProps<typeof Flex>, 'children'> & {
    label: string;
    isLoading?: boolean;
};

const GroupsSectionHeader = ({ label, isLoading = false, ...flexProps }: Props) => {
    const { t } = useTranslation('dashboard');

    return (
        <Flex align="center" justify="between" gap="3" wrap="wrap" {...flexProps}>
            <Flex align="center" gap="2">
                <Skeleton loading={isLoading}>
                    <Avatar size="2" color="gray" fallback={<LucideUsers size={18} />} />
                </Skeleton>
                <Skeleton loading={isLoading}>
                    <Text size="2" color="gray" weight="medium">
                        {label}
                    </Text>
                </Skeleton>
            </Flex>

            <CreateUpdateGroupModal type="create">
                <Button size="2" variant="soft" loading={isLoading}>
                    <LucidePlus size={16} />
                    {t('groups.create')}
                </Button>
            </CreateUpdateGroupModal>
        </Flex>
    );
};

export default GroupsSectionHeader;
