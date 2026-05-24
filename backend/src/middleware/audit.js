import { query } from '../config/db.js';

/**
 * Call from any controller to write an audit record.
 * Fire-and-forget — never throws so it can't break the request.
 */
export async function logAudit(actorId, action, entityType, entityId = null, metadata = null) {
  try {
    await query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    console.warn('audit log write failed:', err.message);
  }
}
