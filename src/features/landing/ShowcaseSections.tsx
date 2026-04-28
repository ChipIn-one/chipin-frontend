import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Box, Container, Flex, Grid, Heading, Section, Text } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

const Placeholder = styled.div`
    width: 100%;
    min-height: 280px;
    border-radius: var(--radius-4);
    background-color: ${themeColor('gray2')};
    border: 1px solid ${themeColor('gray6')};
    display: grid;
    place-items: center;
    color: ${themeColor('gray11')};
    font-size: 14px;
`;

const ShowcaseSections = () => {
    const { t } = useTranslation('landing');

    return (
        <>
            <Section id="how-it-works" py="8">
                <Container size="4">
                    <Grid columns={{ initial: '1', md: '2' }} gap="8" align="center">
                        <Flex direction="column" gap="3">
                            <Heading size={{ initial: '6', md: '7' }}>
                                {t('sections.groups.title')}
                            </Heading>
                            <Text size="4" color="gray">
                                {t('sections.groups.description')}
                            </Text>
                        </Flex>
                        <Placeholder aria-label={t('sections.groups.placeholder')}>
                            {t('sections.groups.placeholder')}
                        </Placeholder>
                    </Grid>
                </Container>
            </Section>

            <Box py="8">
                <Container size="4">
                    <Grid columns={{ initial: '1', md: '2' }} gap="8" align="center">
                        <Box display={{ initial: 'none', md: 'block' }}>
                            <Placeholder aria-label={t('sections.expenses.placeholder')}>
                                {t('sections.expenses.placeholder')}
                            </Placeholder>
                        </Box>
                        <Flex direction="column" gap="3">
                            <Heading size={{ initial: '6', md: '7' }}>
                                {t('sections.expenses.title')}
                            </Heading>
                            <Text size="4" color="gray">
                                {t('sections.expenses.description')}
                            </Text>
                        </Flex>
                        <Box display={{ initial: 'block', md: 'none' }}>
                            <Placeholder aria-label={t('sections.expenses.placeholder')}>
                                {t('sections.expenses.placeholder')}
                            </Placeholder>
                        </Box>
                    </Grid>
                </Container>
            </Box>

            <Section py="8">
                <Container size="4">
                    <Grid columns={{ initial: '1', md: '2' }} gap="8" align="center">
                        <Flex direction="column" gap="3">
                            <Heading size={{ initial: '6', md: '7' }}>
                                {t('sections.balances.title')}
                            </Heading>
                            <Text size="4" color="gray">
                                {t('sections.balances.description')}
                            </Text>
                        </Flex>
                        <Placeholder aria-label={t('sections.balances.placeholder')}>
                            {t('sections.balances.placeholder')}
                        </Placeholder>
                    </Grid>
                </Container>
            </Section>
        </>
    );
};

export default ShowcaseSections;
