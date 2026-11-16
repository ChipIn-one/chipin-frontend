// Source maps are uploaded to Sentry only from Vercel production builds (#575).
// Promote to Production rebuilds the chosen master commit with VERCEL_ENV=production,
// so preview, local and CI builds skip the upload and do not emit source maps at all.
export const shouldUploadSourcemaps = (env: Record<string, string | undefined>): boolean =>
    env.VERCEL === '1' && env.VERCEL_ENV === 'production';
