import { LucideCheckCircle, LucideUsers, LucideWallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Badge, Box, Container, Flex, Grid, Heading, Section, Text } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

const Placeholder = styled.div`
    width: 100%;
    min-height: 420px;
    border-radius: var(--radius-4);
    background-color: ${themeColor('gray2')};
    border: 1px solid ${themeColor('gray6')};
    display: grid;
    place-items: center;
    color: ${themeColor('gray11')};
    font-size: 14px;
`;

const GROUPS_BULLETS = [
    'shareableLink',
    'realTimeBalances',
    'debtSimplification',
    'multiCurrency',
] as const;

const EXPENSES_BULLETS = [
    'logExpenses',
    'setBudgets',
    'monthlySummaries',
    'worksAlongside',
] as const;

const ShowcaseSections = () => {
    const { t } = useTranslation('landing');

    return (
        <>
            <Section py="8">
                <Container size="4">
                    <Grid columns={{ initial: '1', md: '2' }} gap="9" align="center">
                        <Flex direction="column" gap="4">
                            <Box width="max-content">
                                <Badge color="green" variant="surface" radius="full" size="3">
                                    <LucideUsers size={14} />
                                    {t('sections.groups.badge')}
                                </Badge>
                            </Box>

                            <Heading size={{ initial: '7', md: '9' }}>
                                {t('sections.groups.titlePart1')}{' '}
                                <Text as="span" color="green">
                                    {t('sections.groups.titleHighlight')}
                                </Text>
                            </Heading>

                            <Text size="4" color="gray">
                                {t('sections.groups.description')}
                            </Text>

                            <Flex direction="column" gap="3">
                                {GROUPS_BULLETS.map(key => (
                                    <Flex key={key} align="center" gap="3">
                                        <Text as="span" color="green">
                                            <LucideCheckCircle size={18} />
                                        </Text>
                                        <Text size="3">{t(`sections.groups.bullets.${key}`)}</Text>
                                    </Flex>
                                ))}
                            </Flex>
                        </Flex>

                        <Placeholder aria-label={t('sections.groups.placeholder')}>
                            {t('sections.groups.placeholder')}
                        </Placeholder>
                    </Grid>
                </Container>
            </Section>

            <Box py="8">
                <Container size="4">
                    <Grid columns={{ initial: '1', md: '2' }} gap="9" align="center">
                        <Box display={{ initial: 'none', md: 'block' }}>
                            <Placeholder aria-label={t('sections.expenses.placeholder')}>
                                {t('sections.expenses.placeholder')}
                            </Placeholder>
                        </Box>
                        <Flex direction="column" gap="4">
                            <Box width="max-content">
                                <Badge color="violet" variant="surface" radius="full" size="3">
                                    <LucideWallet size={14} />
                                    {t('sections.expenses.badge')}
                                </Badge>
                            </Box>

                            <Heading size={{ initial: '7', md: '9' }}>
                                {t('sections.expenses.titlePart1')}{' '}
                                <Text as="span" color="violet">
                                    {t('sections.expenses.titleHighlight')}
                                </Text>
                            </Heading>

                            <Text size="4" color="gray">
                                {t('sections.expenses.description')}
                            </Text>

                            <Flex direction="column" gap="3">
                                {EXPENSES_BULLETS.map(key => (
                                    <Flex key={key} align="center" gap="3">
                                        <Text as="span" color="violet">
                                            <LucideCheckCircle size={18} />
                                        </Text>
                                        <Text size="3">
                                            {t(`sections.expenses.bullets.${key}`)}
                                        </Text>
                                    </Flex>
                                ))}
                            </Flex>
                        </Flex>
                        <Box display={{ initial: 'block', md: 'none' }}>
                            <Placeholder aria-label={t('sections.expenses.placeholder')}>
                                {t('sections.expenses.placeholder')}
                            </Placeholder>
                        </Box>
                    </Grid>
                </Container>
            </Box>
        </>
    );
};

export default ShowcaseSections;
