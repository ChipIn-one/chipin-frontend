// Not `astro:content`: its types exist only after `astro sync`, and lint runs without them.
import { defineCollection } from 'astro/content/config';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { contentBase } from './lib/contentSchema';

// Astro 7 reads collections only from `src/content.config.ts` (spec 04 §3.3, A-14).
// Files live at `<collection>/<locale path>/<slug>.md(x)`; the content arrives in 04-3b2 and later.
export const collections = {
    legal: defineCollection({
        loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
        schema: contentBase,
    }),
    help: defineCollection({
        loader: glob({ pattern: '**/*.mdx', base: './src/content/help' }),
        schema: contentBase,
    }),
    blog: defineCollection({
        loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
        schema: contentBase.extend({
            author: z.string(),
            tags: z.array(z.string()).default([]),
        }),
    }),
};
