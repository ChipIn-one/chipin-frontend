// The build flag of offline expense writes (spec 03 §2.7): off unless `VITE_FEATURE_OFFLINE_WRITES`
// is exactly `true`. Off, every write takes the online path as before the outbox (03-17 enables it).
export const isOfflineWritesFlagOn = (): boolean =>
    import.meta.env.VITE_FEATURE_OFFLINE_WRITES === 'true';
