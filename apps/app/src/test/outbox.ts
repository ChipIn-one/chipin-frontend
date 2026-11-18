// Test support: the expense outbox (spec 03 §2.3) for tests of the layers that may not import
// `shared/offline`: the queued ops, and a reset of this tab's outbox memory.
export { pendingOutboxOps, resetOutbox } from 'shared/offline/outboxStore';
