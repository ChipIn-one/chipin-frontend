/* eslint-disable react-refresh/only-export-components -- dev-only design-system gallery entry, never shipped in the app bundle */
import { type ReactNode, useState } from 'react';
import i18n from 'i18n';
import { LucideMinus, LucideMoon, LucidePlus, LucideSun, LucideTrash2, LucideUsers } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import { Trans, useTranslation } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';

import {
    Badge,
    Box,
    Button,
    Card,
    Code,
    Flex,
    Grid,
    Heading,
    IconButton,
    Select as RSelect,
    Separator,
    Switch,
    Text,
    Theme,
} from '@radix-ui/themes';

import { SUPPORTED_LOCALES } from 'constants/locales';
import { darkThemeStyled, lightThemeStyled } from 'constants/styled-themes';

import CopyButton from 'basics/buttons/CopyButton';
import DebtAmount from 'basics/DebtAmount';
import {
    Amount,
    AmountInput,
    BalanceBadges,
    BalanceSummaryText,
    Checkbox,
    ChipInLoader,
    EmptyState,
    GroupRoleBadge,
    NoActivityEmptyState,
    NoFriendsEmptyState,
    NoGroupExpensesEmptyState,
    NoGroupsEmptyState,
    OwedStatusText,
    RadioCards,
    RadioGroup,
    TextArea,
    TextInput,
    UserAvatar,
} from 'basics/index';
import Dropdown from 'components/Dropdown';
import GroupAvatar from 'components/GroupAvatar';
import { ModeLogotype } from 'components/mode-logotype';
import { ProgressBar } from 'components/progress-bar';
import SegmentedControl from 'components/SegmentedControl';
import Select from 'components/Select';
import { ActivityFeedSkeleton, BalanceBadgesSkeleton, GroupsCardsSkeleton } from 'components/skeletons';
import { SummaryDebtCards, TotalBalanceCard } from 'components/summary-debt-cards';
import UsersRow from 'components/UsersRow';

import { GALLERY_NS, galleryResources } from './locales';

import '@radix-ui/themes/styles.css';
import 'styles/radixStylesOverwrite.css';

SUPPORTED_LOCALES.forEach(locale => i18n.addResourceBundle(locale, GALLERY_NS, galleryResources[locale], true, true));

const EMPTY_VALUE = '∅';

const users = [
    { id: 'u1', displayName: 'Anna', picture: '' },
    { id: 'u2', displayName: 'Boris', picture: '' },
    { id: 'u3', displayName: 'Chloe', picture: '' },
    { id: 'u4', displayName: 'Dmitry', picture: '' },
    { id: 'u5', displayName: 'Eva', picture: '' },
    { id: 'u6', displayName: 'Felix', picture: '' },
    { id: 'u7', displayName: 'Gleb', picture: '' },
] as unknown as Parameters<typeof UsersRow>[0]['members'];

const NAV_IDS = ['tokens', 'type', 'actions', 'inputs', 'money', 'identity', 'feedback', 'cards', 'empty'] as const;

const SCALE_COLORS = ['grass', 'olive', 'green', 'red', 'amber', 'violet', 'cyan', 'jade', 'indigo', 'mint', 'gray'] as const;

const Section = ({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) => (
    <Box id={id} asChild>
        <section style={{ scrollMarginTop: 72 }}>
            <Flex direction="column" gap="3" mb="7">
                <Flex direction="column" gap="1">
                    <Heading size="5">{title}</Heading>
                    {note && <Text size="2" color="gray">{note}</Text>}
                </Flex>
                {children}
            </Flex>
        </section>
    </Box>
);

const Specimen = ({ name, children, wide }: { name: string; children: ReactNode; wide?: boolean }) => (
    <Card size="2" style={wide ? { gridColumn: '1 / -1' } : undefined}>
        <Flex direction="column" gap="3">
            <Code size="1" variant="ghost" color="gray">{name}</Code>
            <Flex gap="3" wrap="wrap" align="center">{children}</Flex>
        </Flex>
    </Card>
);

const Swatches = () => (
    <Grid columns={{ initial: '1', sm: '2' }} gap="3">
        {SCALE_COLORS.map(color => (
            <Flex key={color} direction="column" gap="1">
                <Text size="1" color="gray">{color}</Text>
                <Flex style={{ borderRadius: 8, overflow: 'hidden' }}>
                    {Array.from({ length: 12 }, (_, i) => (
                        <Box key={i} title={`--${color}-${i + 1}`} style={{ flex: 1, height: 28, background: `var(--${color}-${i + 1})` }} />
                    ))}
                </Flex>
            </Flex>
        ))}
    </Grid>
);

const Gallery = ({ isDark, onToggleDark }: { isDark: boolean; onToggleDark: () => void }) => {
    const { t } = useTranslation(GALLERY_NS);
    const [locale, setLocale] = useState(i18n.resolvedLanguage ?? 'en');
    const [amount, setAmount] = useState('42.50');
    const [segment, setSegment] = useState('all');
    const [selectValue, setSelectValue] = useState('eur');
    const [radio, setRadio] = useState('equal');
    const [isSolo, setIsSolo] = useState(false);
    const [progress, setProgress] = useState(64);

    const onLocaleChange = (next: string) => {
        i18n.changeLanguage(next).then(() => setLocale(next)).catch(() => undefined);
    };

    return (
        <Box>
            <Box
                px="4"
                py="3"
                style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-panel-solid)', borderBottom: '1px solid var(--gray-a5)' }}
            >
                <Flex justify="between" align="center" gap="3" wrap="wrap" style={{ maxWidth: 1080, margin: '0 auto' }}>
                    <ModeLogotype isSoloMode={isSolo} />
                    <Flex gap="2" align="center">
                        <RSelect.Root value={locale} onValueChange={onLocaleChange} size="2">
                            <RSelect.Trigger variant="soft" aria-label={t('controls.locale')} />
                            <RSelect.Content>
                                {SUPPORTED_LOCALES.map(l => <RSelect.Item key={l} value={l}>{l}</RSelect.Item>)}
                            </RSelect.Content>
                        </RSelect.Root>
                        <IconButton variant="soft" onClick={onToggleDark} aria-label={t('controls.toggleTheme')}>
                            {isDark ? <LucideSun size={16} /> : <LucideMoon size={16} />}
                        </IconButton>
                    </Flex>
                </Flex>
            </Box>

            <Box px="4" py="6" style={{ maxWidth: 1080, margin: '0 auto' }}>
                <Flex direction="column" gap="2" mb="5">
                    <Heading size="8">{t('title')}</Heading>
                    <Text color="gray" size="3">
                        <Trans t={t} i18nKey="intro" components={{ code: <Code /> }} />
                    </Text>
                </Flex>
                <Flex gap="2" wrap="wrap" mb="7">
                    {NAV_IDS.map(id => (
                        <Button key={id} asChild size="1" variant="soft" color="gray"><a href={`#${id}`}>{t(`nav.${id}`)}</a></Button>
                    ))}
                </Flex>

                <Section id="tokens" title={t('sections.tokens')} note={t('notes.tokens')}>
                    <Swatches />
                </Section>

                <Section id="type" title={t('sections.type')} note={t('notes.type')}>
                    <Card size="2">
                        <Flex direction="column" gap="2">
                            {(['9', '8', '7', '6', '5'] as const).map(s => <Heading key={s} size={s}>{t('samples.heading', { size: s })}</Heading>)}
                            <Separator size="4" my="2" />
                            {(['4', '3', '2', '1'] as const).map(s => <Text key={s} size={s}>{t('samples.text', { size: s })}</Text>)}
                        </Flex>
                    </Card>
                </Section>

                <Section id="actions" title={t('sections.actions')}>
                    <Grid columns={{ initial: '1', md: '2' }} gap="3">
                        <Specimen name="Button · variants">
                            <Button>{t('common:buttons.addExpense')}</Button>
                            <Button variant="soft">{t('common:buttons.settleUp')}</Button>
                            <Button variant="outline">{t('samples.invite')}</Button>
                            <Button variant="ghost">{t('common:buttons.cancel')}</Button>
                            <Button color="red" variant="soft"><LucideTrash2 size={16} />{t('common:buttons.delete')}</Button>
                        </Specimen>
                        <Specimen name="IconButton / Button sizes">
                            <IconButton size="3" radius="full"><LucidePlus /></IconButton>
                            {(['1', '2', '3'] as const).map(s => <Button key={s} size={s}>{t('samples.size', { size: s })}</Button>)}
                        </Specimen>
                        <Specimen name="basics/CopyButton">
                            <CopyButton value="https://chipin.one/invite/abc" what="link">{t('group:page.settings.copyLinkTitle')}</CopyButton>
                            <CopyButton value="ABC123" what="code" variant="soft" size="2">{t('samples.copyCode')}</CopyButton>
                        </Specimen>
                        <Specimen name="components/Dropdown">
                            <Dropdown
                                trigger={<Button variant="soft">{t('samples.groupActions')}</Button>}
                                sections={[
                                    { label: t('common:modes.group'), items: [{ value: 'edit', label: t('group:modal.titleEdit') }, { value: 'invite', label: t('samples.inviteMembers') }] },
                                    { items: [{ value: 'leave', label: t('common:buttons.leaveGroup'), color: 'red', icon: <LucideTrash2 size={14} /> }] },
                                ]}
                            />
                        </Specimen>
                        <Specimen name="components/SegmentedControl" wide>
                            <SegmentedControl
                                value={segment}
                                onValueChange={setSegment}
                                items={[{ value: 'all', label: t('dashboard:groups.filterAll') }, { value: 'owed', label: t('dashboard:summary.owedToYou') }, { value: 'owes', label: t('dashboard:summary.youOwe') }]}
                            />
                        </Specimen>
                    </Grid>
                </Section>

                <Section id="inputs" title={t('sections.inputs')}>
                    <Grid columns={{ initial: '1', md: '2' }} gap="3">
                        <Specimen name="basics/TextInput">
                            <Box width="100%">
                                <TextInput label={t('common:fields.groupName')} description={t('samples.groupNameHint')} initialValue="Lisbon trip" isRequired />
                            </Box>
                        </Specimen>
                        <Specimen name="basics/TextArea">
                            <Box width="100%">
                                <TextArea label={t('samples.note')} initialValue="Dinner at Time Out Market" />
                            </Box>
                        </Specimen>
                        <Specimen name="basics/AmountInput">
                            <AmountInput value={amount} onChange={setAmount} size="3" />
                            <Text size="2" color="gray">{t('samples.value')} <Code>{amount || EMPTY_VALUE}</Code></Text>
                        </Specimen>
                        <Specimen name="components/Select">
                            <Select
                                value={selectValue}
                                onChange={setSelectValue}
                                items={(['EUR', 'USD', 'VND'] as const).map(code => ({ value: code.toLowerCase(), label: t(`currencies:${code}`) }))}
                            />
                        </Specimen>
                        <Specimen name="basics/Checkbox · Switch">
                            <Flex asChild gap="2" align="center"><label><Checkbox defaultChecked /> <Text size="2">{t('samples.includeMe')}</Text></label></Flex>
                            <Flex asChild gap="2" align="center"><label><Checkbox /> <Text size="2">{t('samples.unchecked')}</Text></label></Flex>
                            <Flex asChild gap="2" align="center"><label><Switch checked={isSolo} onCheckedChange={setIsSolo} color="violet" /> <Text size="2">{t('samples.soloSwitch')}</Text></label></Flex>
                        </Specimen>
                        <Specimen name="basics/RadioGroup">
                            <RadioGroup value={radio} onValueChange={setRadio} items={[
                                { value: 'equal', label: t('samples.splitEqually') },
                                { value: 'exact', label: t('activity:subeventsSharingModes.exact') },
                                { value: 'shares', label: t('samples.byShares'), isDisabled: true },
                            ]} />
                        </Specimen>
                        <Specimen name="basics/RadioCards" wide>
                            <Box width="100%">
                                <RadioCards defaultValue="group" columns={{ initial: '1', sm: '3' }} items={[
                                    { value: 'group', label: t('samples.groupExpense'), icon: <LucideUsers size={16} /> },
                                    { value: 'friend', label: t('samples.withFriend') },
                                    { value: 'solo', label: t('samples.personal') },
                                ] as Parameters<typeof RadioCards>[0]['items']} />
                            </Box>
                        </Specimen>
                    </Grid>
                </Section>

                <Section id="money" title={t('sections.money')} note={t('notes.money')}>
                    <Grid columns={{ initial: '1', md: '2' }} gap="3">
                        <Specimen name="basics/numbers/Amount">
                            <Text size="5"><Amount value={1234.5} tokenCode="EUR" /></Text>
                            <Text size="5"><Amount value={-87.2} tokenCode="USD" /></Text>
                            <Text size="5"><Amount value={0.004} tokenCode="EUR" /></Text>
                            <Text size="5"><Amount value={2500000} tokenCode="VND" type="summary" /></Text>
                        </Specimen>
                        <Specimen name="basics/DebtAmount">
                            <DebtAmount amount={120.4} currency="EUR" size="6" weight="bold" withPlus />
                            <DebtAmount amount={-45} currency="EUR" size="6" weight="bold" />
                            <DebtAmount amount={0} currency="EUR" size="6" />
                        </Specimen>
                        <Specimen name="basics/OwedStatusText">
                            <Flex direction="column" gap="1">
                                <OwedStatusText value={32.1} currencyCode="EUR" size="2" align="left" />
                                <OwedStatusText value={-18} currencyCode="USD" size="2" align="left" />
                                <OwedStatusText value={0} currencyCode="EUR" size="2" align="left" />
                            </Flex>
                        </Specimen>
                        <Specimen name="basics/BalanceSummaryText">
                            <BalanceSummaryText size="2" entries={[{ currency: 'EUR', netBalance: 54.3 }, { currency: 'USD', netBalance: -12 }, { currency: 'GBP', netBalance: 8 }]} />
                        </Specimen>
                        <Specimen name="basics/BalanceBadges" wide>
                            <BalanceBadges items={[
                                { tokenCode: 'EUR', value: 54.3, color: 'green' },
                                { tokenCode: 'USD', value: -12, color: 'red' },
                                { tokenCode: 'GBP', value: 8, color: 'green' },
                                { tokenCode: 'VND', value: -150000, color: 'red' },
                                { tokenCode: 'THB', value: 300, color: 'green' },
                            ]} />
                        </Specimen>
                    </Grid>
                </Section>

                <Section id="identity" title={t('sections.identity')}>
                    <Grid columns={{ initial: '1', md: '2' }} gap="3">
                        <Specimen name="basics/UserAvatar">
                            {(['1', '2', '3', '4', '5'] as const).map(s => <UserAvatar key={s} size={s} user={{ displayName: 'Anna', picture: '' } as never} />)}
                            <UserAvatar size="3" isLoading />
                        </Specimen>
                        <Specimen name="components/GroupAvatar">
                            <GroupAvatar group={{ name: 'Lisbon', coverUrl: null } as never} />
                            <GroupAvatar group={{ name: 'Flat', coverUrl: null } as never} color="violet" />
                            <GroupAvatar group={{ name: 'Ski', coverUrl: null } as never} color="cyan" variant="solid" size="3" />
                        </Specimen>
                        <Specimen name="components/UsersRow">
                            <UsersRow members={users} max={5} size="2" />
                            <UsersRow members={users.slice(0, 3)} />
                        </Specimen>
                        <Specimen name="basics/GroupRoleBadge · Badge">
                            <GroupRoleBadge isOwner />
                            <Badge color="green">{t('dashboard:groups.filterSettled')}</Badge>
                            <Badge color="red" variant="soft">{t('samples.owes')}</Badge>
                            <Badge color="violet" variant="surface">{t('common:modes.solo')}</Badge>
                        </Specimen>
                        <Specimen name="components/ModeLogotype" wide>
                            <ModeLogotype isSoloMode={false} />
                            <ModeLogotype isSoloMode />
                        </Specimen>
                    </Grid>
                </Section>

                <Section id="feedback" title={t('sections.feedback')}>
                    <Grid columns={{ initial: '1', md: '2' }} gap="3">
                        <Specimen name="basics/ChipInLoader">
                            <ChipInLoader size={48} />
                            <ChipInLoader size={32} strokeWidth={3} />
                        </Specimen>
                        <Specimen name="components/ProgressBar">
                            <Flex direction="column" gap="2" width="100%">
                                <ProgressBar value={progress} />
                                <ProgressBar value={progress} size="3" color="violet" />
                                <Flex gap="2"><IconButton size="1" variant="soft" aria-label={t('controls.decrease')} onClick={() => setProgress(p => Math.max(0, p - 16))}><LucideMinus size={14} /></IconButton><IconButton size="1" variant="soft" aria-label={t('controls.increase')} onClick={() => setProgress(p => Math.min(100, p + 16))}><LucidePlus size={14} /></IconButton></Flex>
                            </Flex>
                        </Specimen>
                        <Specimen name="skeletons/BalanceBadgesSkeleton">
                            <BalanceBadgesSkeleton />
                        </Specimen>
                        <Specimen name="skeletons/GroupsCardsSkeleton">
                            <Box width="100%"><GroupsCardsSkeleton label={t('dashboard:groups.title')} /></Box>
                        </Specimen>
                        <Specimen name="skeletons/ActivityFeedSkeleton" wide>
                            <Box width="100%"><ActivityFeedSkeleton /></Box>
                        </Specimen>
                    </Grid>
                </Section>

                <Section id="cards" title={t('sections.cards')}>
                    <Grid columns={{ initial: '1', md: '2' }} gap="3">
                        <Flex direction="column" gap="3">
                            <TotalBalanceCard isLoading={false} netTotalInBase={182.7} defaultCurrency="EUR" />
                            <TotalBalanceCard isLoading netTotalInBase={null} defaultCurrency="EUR" />
                        </Flex>
                        <SummaryDebtCards
                            owedToYouTotal={240.5}
                            youOweTotal={57.8}
                            owedEntries={[{ currency: 'EUR', netBalance: 200 }, { currency: 'USD', netBalance: 44 }]}
                            oweEntries={[{ currency: 'EUR', netBalance: -57.8 }]}
                            defaultCurrency="EUR"
                        />
                    </Grid>
                </Section>

                <Section id="empty" title={t('sections.empty')}>
                    <Grid columns={{ initial: '1', md: '2' }} gap="3">
                        <Card size="2"><NoGroupsEmptyState action={<Button size="2"><LucidePlus size={16} />{t('common:buttons.createGroup')}</Button>} /></Card>
                        <Card size="2"><NoFriendsEmptyState /></Card>
                        <Card size="2"><NoGroupExpensesEmptyState /></Card>
                        <Card size="2"><NoActivityEmptyState /></Card>
                        <Card size="2" style={{ gridColumn: '1 / -1' }}>
                            <EmptyState icon={<LucideUsers size={20} />} iconColor="violet" title={t('samples.customEmptyTitle')} description={t('samples.customEmptyDescription')} actionPosition="inline" action={<Button variant="soft" size="2">{t('samples.action')}</Button>} />
                        </Card>
                    </Grid>
                </Section>

                <Text size="1" color="gray">{t('footer', { date: new Date().toISOString().slice(0, 10) })}</Text>
            </Box>
        </Box>
    );
};

const App = () => {
    const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const [isDark, setIsDark] = useState(Boolean(prefersDark));

    return (
        <ThemeProvider theme={isDark ? darkThemeStyled : lightThemeStyled}>
            <Theme appearance={isDark ? 'dark' : 'light'} accentColor="grass" grayColor="olive" radius="large" panelBackground="solid" hasBackground>
                <MemoryRouter>
                    <Gallery isDark={isDark} onToggleDark={() => setIsDark(d => !d)} />
                </MemoryRouter>
            </Theme>
        </ThemeProvider>
    );
};

createRoot(document.getElementById('root')!).render(<App />);
