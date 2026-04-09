import { LucidePlus, LucideUsers } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, Button, Flex, Text } from '@radix-ui/themes';

import CreateUpdateGroupModal from 'components/Modal/CreateUpdateGroupModal';

type Props = Omit<ComponentProps<typeof Flex>, 'children'> & {
    label: string;
    buttonVariant?: ComponentProps<typeof Button>['variant'];
};

const GroupsSectionHeader = ({ label, buttonVariant = 'soft', ...flexProps }: Props) => {
    const { t } = useTranslation();

    return (
        <Flex align="center" justify="between" gap="3" wrap="wrap" {...flexProps}>
            <Flex align="center" gap="2">
                <Avatar size="2" color="gray" fallback={<LucideUsers size={18} />} />
                <Text size="2" color="gray" weight="medium">
                    {label}
                </Text>
            </Flex>

            <CreateUpdateGroupModal type="create">
                <Button size="2" variant={buttonVariant}>
                    <LucidePlus size={16} />
                    {t('dashboard.groups.create')}
                </Button>
            </CreateUpdateGroupModal>
        </Flex>
    );
};

export default GroupsSectionHeader;
