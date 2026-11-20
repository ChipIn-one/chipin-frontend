import { z } from 'astro/zod';

import { SUPPORTED_LOCALES } from '../i18n/locales';

/** Frontmatter shared by every collection (spec 04 §3.3); an invalid entry fails `astro build`. */
const contentBase = z.object({
    title: z.string().min(1),
    description: z.string().min(50).max(160),
    locale: z.enum(SUPPORTED_LOCALES),
    // Links the translations of one page for hreflang.
    translationKey: z.string().min(1),
    updatedAt: z.coerce.date(),
    draft: z.boolean().default(false),
    ogImage: z.string().optional(),
});

export { contentBase };
