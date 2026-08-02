import { UserAvatar } from 'basics';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { Flex, Skeleton, Text } from '@radix-ui/themes';

import type { UserSummary } from 'api/chipin.types';

interface Props {
    avatarSize?: ComponentProps<typeof UserAvatar>['size'];
    isLoading?: boolean;
    user?: UserSummary;
}

const UserProfileSummary = ({ avatarSize = '5', isLoading = false, user }: Props) => {
    const { t } = useTranslation('common');
    const { t: tSkeletons } = useTranslation('skeletons');

    return (
        <Flex align="center" gap="2" minWidth="0">
            <UserAvatar size={avatarSize} user={user} isLoading={isLoading} />

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
