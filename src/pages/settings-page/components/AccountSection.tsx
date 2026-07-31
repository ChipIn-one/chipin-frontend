import { useState } from 'react';
import { RadioGroup, UserAvatar } from 'basics';
import { LucideUser } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import {
    Avatar,
    Box,
    Card,
    Flex,
    Link,
    Separator,
    Skeleton,
    Text,
    TextField,
} from '@radix-ui/themes';

import { selectUserSex, useUsersStore } from 'store/users-store';

interface Props {
    isLoading: boolean;
}

const AccountSection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');
    const { t: tSkeletons } = useTranslation('skeletons');
    const { user, sex, setUserSettings } = useUsersStore(
        useShallow(state => ({
            user: state.user,
            sex: selectUserSex(state),
            setUserSettings: state.setUserSettings,
        })),
    );
    const [displayNameDraft, setDisplayNameDraft] = useState<string>();
    const displayName = displayNameDraft ?? user?.displayName ?? '';

    const onChangeDisplayName = (event: ChangeEvent<HTMLInputElement>) => {
        setDisplayNameDraft(event.target.value);
    };

    const onBlurDisplayName = () => {
        void setUserSettings({ displayName }).catch(() => undefined);
    };

    const onSexChange = (value: string) => {
        if (value !== 'male' && value !== 'female') {
            return;
        }

        void setUserSettings({ settings: { sex: value } }).catch(() => undefined);
    };

    return (
        <Card size="3">
            <Flex direction="column" gap="4">
                <Flex align="center" gap="3">
                    <Skeleton loading={isLoading}>
                        <Avatar
                            variant="soft"
                            size="3"
                            color="mint"
                            fallback={<LucideUser size={20} />}
                        />
                    </Skeleton>
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('account.title')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('account.description')}
                            </Skeleton>
                        </Text>
                    </Flex>
                </Flex>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="4">
                    <Flex align="center" gap="3" minWidth="0">
                        <UserAvatar size="4" user={user ?? undefined} isLoading={isLoading} />

                        <Flex direction="column" gap="1" minWidth="0">
                            <Text weight="medium" size="3" truncate>
                                <Skeleton loading={isLoading}>
                                    {isLoading
                                        ? tSkeletons('account.displayName')
                                        : user?.displayName || t('common:fields.displayName')}
                                </Skeleton>
                            </Text>
                            <Text size="2" color="gray" truncate>
                                <Skeleton loading={isLoading}>
                                    {isLoading ? tSkeletons('account.email') : user?.email}
                                </Skeleton>
                            </Text>
                            <Skeleton loading={isLoading}>
                                <Link size="2" color="green" href="#">
                                    {t('common:buttons.changePhoto')}
                                </Link>
                            </Skeleton>
                        </Flex>
                    </Flex>

                    <Skeleton loading={isLoading}>
                        <RadioGroup
                            name="sex"
                            size="2"
                            value={sex}
                            items={[
                                {
                                    value: 'male',
                                    label: t('account.sexOptions.male'),
                                },
                                {
                                    value: 'female',
                                    label: t('account.sexOptions.female'),
                                },
                            ]}
                            onValueChange={onSexChange}
                        />
                    </Skeleton>
                </Flex>

                <Separator size="4" />

                <Box>
                    <Text size="2" color="gray">
                        <Skeleton loading={isLoading}>
                            {t('common:fields.displayName')}
                        </Skeleton>
                    </Text>
                    <Skeleton loading={isLoading}>
                        <TextField.Root
                            mt="2"
                            size="3"
                            value={displayName}
                            placeholder={t('account.displayNamePlaceholder')}
                            onChange={onChangeDisplayName}
                            onBlur={onBlurDisplayName}
                        />
                    </Skeleton>
                </Box>
            </Flex>
        </Card>
    );
};

export default AccountSection;
