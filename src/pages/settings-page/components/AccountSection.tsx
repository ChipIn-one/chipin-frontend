import { RadioCards, TextInput } from 'basics';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Button, Card, Flex, Grid, Separator, Skeleton, Text } from '@radix-ui/themes';

import { selectUserSex, useUsersStore } from 'store/users-store';

import { UserAvatarModal } from 'components/modals';
import { UserProfileSummary } from 'components/user-profile-summary';

interface Props {
    isLoading: boolean;
}

const DISPLAY_NAME_MAX_LENGTH = 64;

const AccountSection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');
    const { user, sex, setUserSettings } = useUsersStore(
        useShallow(state => ({
            user: state.user,
            sex: selectUserSex(state),
            setUserSettings: state.setUserSettings,
        })),
    );

    const onDisplayNameCommit = (displayName: string) => {
        if (displayName === user?.displayName) {
            return;
        }

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
            <Flex direction="column" gap="5">
                <Text size="4" weight="bold">
                    <Skeleton loading={isLoading}>{t('account.title')}</Skeleton>
                </Text>

                <Flex
                    direction={{ initial: 'column', sm: 'row' }}
                    align={{ initial: 'stretch', sm: 'center' }}
                    justify="between"
                    gap="4"
                >
                    <UserProfileSummary
                        user={user ?? undefined}
                        isLoading={isLoading}
                    />

                    <UserAvatarModal>
                        <Button
                            type="button"
                            size="2"
                            variant="outline"
                            color="gray"
                            disabled={isLoading}
                        >
                            <Skeleton loading={isLoading}>
                                {t('common:buttons.changePhoto')}
                            </Skeleton>
                        </Button>
                    </UserAvatarModal>
                </Flex>

                <Separator size="4" />

                <Grid columns={{ initial: '1', sm: '2' }} gap="4" align="center">
                    <Flex direction="column" gap="1">
                        <Text size="2" weight="medium">
                            <Skeleton loading={isLoading}>{t('account.genderTitle')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('account.genderDescription')}
                            </Skeleton>
                        </Text>
                    </Flex>

                    <RadioCards
                        aria-label={t('account.genderTitle')}
                        name="sex"
                        size="1"
                        color="jade"
                        variant="surface"
                        columns={{ initial: '1', xs: '2' }}
                        value={sex}
                        disabled={isLoading}
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
                </Grid>

                <Separator size="4" />

                <TextInput
                    key={user?.displayName ?? ''}
                    label={
                        <Skeleton loading={isLoading}>
                            {t('common:fields.displayName')}
                        </Skeleton>
                    }
                    description={
                        <Skeleton loading={isLoading}>
                            {t('account.displayNameDescription')}
                        </Skeleton>
                    }
                    size="3"
                    initialValue={user?.displayName ?? ''}
                    isRequired
                    maxLength={DISPLAY_NAME_MAX_LENGTH}
                    placeholder={t('account.displayNamePlaceholder')}
                    disabled={isLoading}
                    validationMessage={t('account.displayNameRequired')}
                    onValueCommit={onDisplayNameCommit}
                />
            </Flex>
        </Card>
    );
};

export default AccountSection;
