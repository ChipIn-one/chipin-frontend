// Released locales are shared by the public manifest and the client locale resolver.
const SUPPORTED_LOCALES = ['en', 'ru', 'es', 'pt-BR', 'pt-PT'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: SupportedLocale = SUPPORTED_LOCALES[0];

export { DEFAULT_LOCALE, SUPPORTED_LOCALES };
export type { SupportedLocale };
