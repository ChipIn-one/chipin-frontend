import { PROP_COLOR } from '@chipin/tokens/theme';
import { Badge } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

interface Props {
    isOwner: boolean;
}

const GroupRoleBadge = ({ isOwner }: Props) => {
    const { t } = useTranslation('common');

    if (!isOwner) {
        return null;
    }

    return (
        <Badge size="1" color={PROP_COLOR.warning} variant="soft">
            {t('roles.owner')}
        </Badge>
    );
};

export default GroupRoleBadge;
