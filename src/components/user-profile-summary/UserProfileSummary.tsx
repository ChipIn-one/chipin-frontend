import { UserAvatar } from 'basics';
import { useTranslation } from 'react-i18next';

import { Flex, Skeleton, Text } from '@radix-ui/themes';

import type { UserSummary } from 'api/chipin.types';

interface Props {
    isLoading?: boolean;
    user?: UserSummary;
}

const UserProfileSummary = ({ isLoading = false, user }: Props) => {
    const { t } = useTranslation('common');
    const { t: tSkeletons } = useTranslation('skeletons');

    return (
        <Flex align="center" gap="3" minWidth="0">
            <UserAvatar size="5" user={user} isLoading={isLoading} />

            <Flex direction="column" gap="1" minWidth="0">
                <Text weight="medium" size="4" truncate>
                    <Skeleton loading={isLoading}>
                        {isLoading
                            ? tSkeletons('account.displayName')
                            : user?.displayName || t('fields.displayName')}
                    </Skeleton>
                </Text>
                <Text size="2" color="gray" truncate>
                    <Skeleton loading={isLoading}>
                        {isLoading ? tSkeletons('account.email') : user?.email}
                    </Skeleton>
                </Text>
            </Flex>
        </Flex>
    );
};

export default UserProfileSummary;
