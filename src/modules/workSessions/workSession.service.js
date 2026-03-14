// src/modules/workSessions/workSession.service.js
const pool = require('../../config/database');

/**
 * Check in to a checkpoint work session
 */
async function checkIn(checkpointId, workerId) {
  // Close any open sessions first (safety)
  await pool.query(
    `UPDATE work_sessions SET check_out = NOW(),
       duration_minutes = EXTRACT(EPOCH FROM (NOW() - check_in)) / 60
     WHERE checkpoint_id = $1 AND worker_id = $2 AND check_out IS NULL`,
    [checkpointId, workerId]
  );

  // Verify checkpoint belongs to this worker
  const cpRes = await pool.query(
    `SELECT ch.*, ct.worker_id FROM checkpoints ch
     JOIN contracts ct ON ct.id = ch.contract_id
     WHERE ch.id = $1`,
    [checkpointId]
  );
  const checkpoint = cpRes.rows[0];
  if (!checkpoint) throw new Error('CHECKPOINT_NOT_FOUND');
  if (Number(checkpoint.worker_id) !== Number(workerId)) throw new Error('UNAUTHORIZED');

  const { rows } = await pool.query(
    `INSERT INTO work_sessions (checkpoint_id, worker_id, check_in)
     VALUES ($1, $2, NOW())
     RETURNING *`,
    [checkpointId, workerId]
  );
  return rows[0];
}

/**
 * Check out from a work session
 */
async function checkOut(checkpointId, workerId, notes) {
  const { rows } = await pool.query(
    `UPDATE work_sessions
     SET check_out = NOW(),
         duration_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - check_in)) / 60),
         notes = $3
     WHERE checkpoint_id = $1 AND worker_id = $2 AND check_out IS NULL
     RETURNING *`,
    [checkpointId, workerId, notes || null]
  );
  if (!rows.length) throw new Error('NO_OPEN_SESSION');
  return rows[0];
}

/**
 * Get all work sessions for a checkpoint
 */
async function getSessionsByCheckpoint(checkpointId) {
  const { rows } = await pool.query(
    `SELECT ws.*,
            u.email as worker_email,
            up.full_name as worker_name
     FROM work_sessions ws
     JOIN users u ON u.id = ws.worker_id
     LEFT JOIN user_profiles up ON up.user_id = u.id
     WHERE ws.checkpoint_id = $1
     ORDER BY ws.check_in DESC`,
    [checkpointId]
  );
  return rows;
}

/**
 * Get total time worked on a checkpoint (in minutes)
 */
async function getTotalTime(checkpointId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
     FROM work_sessions
     WHERE checkpoint_id = $1 AND check_out IS NOT NULL`,
    [checkpointId]
  );
  return Number(rows[0].total_minutes);
}

/**
 * Get active session for a checkpoint+worker
 */
async function getActiveSession(checkpointId, workerId) {
  const { rows } = await pool.query(
    `SELECT * FROM work_sessions
     WHERE checkpoint_id = $1 AND worker_id = $2 AND check_out IS NULL
     ORDER BY check_in DESC LIMIT 1`,
    [checkpointId, workerId]
  );
  return rows[0] || null;
}

module.exports = { checkIn, checkOut, getSessionsByCheckpoint, getTotalTime, getActiveSession };
