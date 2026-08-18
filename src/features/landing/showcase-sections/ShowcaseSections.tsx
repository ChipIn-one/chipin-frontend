import { LucideUsers, LucideWallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Container, Section } from '@radix-ui/themes';

import { GroupPagePreview, ShowcaseSection, SoloPagePreview } from './components';
import { EXPENSES_BULLET_KEYS, GROUPS_BULLET_KEYS } from './internal';

const ShowcaseSections = () => {
    const { t } = useTranslation('landing');
    const groupsBullets = GROUPS_BULLET_KEYS.map(key => ({
        key,
        text: t(`sections.groups.bullets.${key}`),
    }));
    const expensesBullets = EXPENSES_BULLET_KEYS.map(key => ({
        key,
        text: t(`sections.expenses.bullets.${key}`),
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

            <Box py="8">
                <Container size="4">
                    <ShowcaseSection
                        badge={t('sections.expenses.badge')}
                        badgeIcon={<LucideWallet size={14} />}
                        bullets={expensesBullets}
                        color="violet"
                        description={t('sections.expenses.description')}
                        isMediaFirst
                        media={<SoloPagePreview />}
                        title={t('sections.expenses.titlePart1')}
                        titleHighlight={t('sections.expenses.titleHighlight')}
                    />
                </Container>
            </Box>
        </>
    );
};

export default ShowcaseSections;
