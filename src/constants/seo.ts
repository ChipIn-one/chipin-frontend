export const HOME_CANONICAL_URL = 'https://chipin.one/';

export const HOME_OPEN_GRAPH = {
    'og:type': 'website',
    'og:site_name': 'ChipIn',
    'og:url': HOME_CANONICAL_URL,
    'og:image': `${HOME_CANONICAL_URL}pwa-512x512.png`,
    'og:image:width': '512',
    'og:image:height': '512',
} as const;
