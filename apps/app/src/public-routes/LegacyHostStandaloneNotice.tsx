import { Callout, Container, Strong } from '@radix-ui/themes';
import { InfoIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useLegacyHostStandaloneAppHost } from 'hooks/useLegacyHostStandaloneAppHost';

// #758: a Home Screen icon installed from a legacy host before step 1 opens this landing as a web
// app; any way to the app host from here opens an in-app sheet whose session never reaches the
// icon. So the landing hides its sign-in CTAs (`SignInEntry`) and shows this one notice: plain text
// with the bare app host, no link (a link would open the same sheet).
const LegacyHostStandaloneNotice = () => {
    const { t } = useTranslation('landing');
    const appHost = useLegacyHostStandaloneAppHost();

    if (appHost === null) {
        return null;
    }

    return (
        <Container size="4" px="4" pt="4">
            <Callout.Root color="amber" size="2" role="status">
                <Callout.Icon>
                    <InfoIcon size={16} aria-hidden="true" />
                </Callout.Icon>
                <Callout.Text>
                    <Strong>{t('legacyHostStandaloneNotice.title')}</Strong>{' '}
                    {t('legacyHostStandaloneNotice.description', { appHost })}
                </Callout.Text>
            </Callout.Root>
        </Container>
    );
};

export { LegacyHostStandaloneNotice };
