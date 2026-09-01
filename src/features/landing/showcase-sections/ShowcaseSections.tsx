import { LucideUsers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Container, Section } from '@radix-ui/themes';

import { GroupPagePreview, ShowcaseSection } from './components';
import { GROUPS_BULLET_KEYS } from './internal';

const ShowcaseSections = () => {
    const { t } = useTranslation('landing');
    const groupsBullets = GROUPS_BULLET_KEYS.map(key => ({
        key,
        text: t(`sections.groups.bullets.${key}`),
    }));
    return (
        <>
            <Section py="8">
                <Container size="4">
                    <ShowcaseSection
                        badge={t('sections.groups.badge')}
                        badgeIcon={<LucideUsers size={14} />}
                        bullets={groupsBullets}
                        color="green"
                        description={t('sections.groups.description')}
                        media={<GroupPagePreview />}
                        title={t('sections.groups.titlePart1')}
                        titleHighlight={t('sections.groups.titleHighlight')}
                    />
                </Container>
            </Section>
        </>
    );
};

export default ShowcaseSections;
