import { Avatar, Card, Flex, Separator, Skeleton, Switch, Text } from '@radix-ui/themes';
import { CircleUserRoundIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { userSaveGroupExpensesToSolo, userSoloModeByDefault } from 'entities/users';
import { useUserSetting } from 'hooks/useSelfUser';
import { useUpdateSelf } from 'hooks/useUserMutations';

interface Props {
    isLoading: boolean;
}

const SoloPreferencesSection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');
    const soloModeByDefault = useUserSetting(userSoloModeByDefault);
    const saveGroupExpensesToSolo = useUserSetting(userSaveGroupExpensesToSolo);
    const { updateSelf } = useUpdateSelf();

    const onSoloModeByDefaultChange = (isEnabled: boolean) => {
        void updateSelf({ settings: { soloModeByDefault: isEnabled } });
    };

    const onSaveGroupExpensesToSoloChange = (isEnabled: boolean) => {
        void updateSelf({ settings: { saveGroupExpensesToSolo: isEnabled } });
    };

    return (
        <Card size="3">
            <Flex direction="column" gap="4">
                <Flex align="center" gap="3">
                    <Skeleton loading={isLoading}>
                        <Avatar
                            variant="soft"
                            size="3"
                            color="violet"
                            fallback={<CircleUserRoundIcon size={20} />}
                        />
                    </Skeleton>
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('solo.title')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>{t('solo.description')}</Skeleton>
                        </Text>
                    </Flex>
                </Flex>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="3">
                    <Flex direction="column">
                        <Text weight="medium">{t('solo.soloModeTitle')}</Text>
                        <Text size="2" color="gray">
                            {t('solo.soloModeDescription')}
                        </Text>
                    </Flex>
                    <Skeleton loading={isLoading}>
                        <Switch
                            color="violet"
                            checked={soloModeByDefault}
                            onCheckedChange={onSoloModeByDefaultChange}
                            aria-label={t('solo.soloModeTitle')}
                        />
                    </Skeleton>
                </Flex>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="3">
                    <Flex direction="column">
                        <Text weight="medium">{t('solo.saveGroupToSoloTitle')}</Text>
                        <Text size="2" color="gray">
                            {t('solo.saveGroupToSoloDescription')}
                        </Text>
                    </Flex>
                    <Skeleton loading={isLoading}>
                        <Switch
                            color="violet"
                            checked={saveGroupExpensesToSolo}
                            onCheckedChange={onSaveGroupExpensesToSoloChange}
                            aria-label={t('solo.saveGroupToSoloTitle')}
                        />
                    </Skeleton>
                </Flex>
            </Flex>
        </Card>
    );
};

export default SoloPreferencesSection;
