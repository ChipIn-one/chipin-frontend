import { LucideChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { IconButton } from '@radix-ui/themes';

const BackButton = () => {
    const { t } = useTranslation('common');
    const navigate = useNavigate();

    return (
        <IconButton
            variant="soft"
            color="gray"
            size="2"
            aria-label={t('buttons.back')}
            onClick={() => navigate(-1)}
        >
            <LucideChevronLeft size={18} />
        </IconButton>
    );
};

export default BackButton;
