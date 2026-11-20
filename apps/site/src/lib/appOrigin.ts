// The app origin of the site's buttons (spec 04 §4.4): PUBLIC_APP_ORIGIN of the site project
// (prod `https://app.chipin.one`, dev and preview `https://app-dev.chipin.one`).
const PROD_APP_ORIGIN = 'https://app.chipin.one';

/**
 * The validated app origin. A Vercel build (`VERCEL=1`) must set it, so a dev or preview deploy
 * never links to the prod app by accident; a local or CI build falls back to the prod origin.
 */
const resolveAppOrigin = ({
    value,
    onVercel,
}: {
    value: string | undefined;
    onVercel: boolean;
}): string => {
    if (value === undefined || value === '') {
        if (onVercel) {
            throw new Error('PUBLIC_APP_ORIGIN must be set for a Vercel build of the site');
        }
        return PROD_APP_ORIGIN;
    }
    let url: URL;

    try {
        url = new URL(value);
    } catch {
        throw new Error(`PUBLIC_APP_ORIGIN is not a URL: ${value}`);
    }
    if (url.protocol !== 'https:' || url.origin !== value) {
        throw new Error(`PUBLIC_APP_ORIGIN must be a bare https origin, got ${value}`);
    }
    return url.origin;
};

export { PROD_APP_ORIGIN, resolveAppOrigin };
