import { ROUTES } from 'constants/routes';
import { HOME_CANONICAL_URL, HOME_OPEN_GRAPH } from 'constants/seo';

const getOrCreateMeta = (attribute: 'name' | 'property', key: string): HTMLMetaElement => {
    let meta = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, key);
        document.head.appendChild(meta);
    }

    return meta;
};

export const updateSeoMetadata = (pathname: string, title: string, description: string): void => {
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (pathname !== ROUTES.HOME) {
        canonical?.remove();

        document.querySelectorAll<HTMLMetaElement>('meta[property^="og:"]').forEach(meta => {
            meta.remove();
        });

        getOrCreateMeta('name', 'robots').setAttribute('content', 'noindex, nofollow');
        return;
    }

    document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.remove();

    if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', HOME_CANONICAL_URL);

    const homepageOpenGraph = {
        ...HOME_OPEN_GRAPH,
        'og:title': title,
        'og:description': description,
    };

    for (const [property, content] of Object.entries(homepageOpenGraph)) {
        getOrCreateMeta('property', property).setAttribute('content', content);
    }
};
