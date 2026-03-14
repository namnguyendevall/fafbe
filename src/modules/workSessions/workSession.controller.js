// src/modules/workSessions/workSession.controller.js
const workSessionService = require('./workSession.service');

async function checkIn(req, res) {
  try {
    const checkpointId = Number(req.params.checkpointId);
    const workerId = req.user.id;
    const session = await workSessionService.checkIn(checkpointId, workerId);
    return res.status(201).json({ message: 'Checked in', data: session });
  } catch (err) {
    if (err.message === 'CHECKPOINT_NOT_FOUND') return res.status(404).json({ message: 'Checkpoint not found' });
    if (err.message === 'UNAUTHORIZED') return res.status(403).json({ message: 'Not authorized for this checkpoint' });
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function checkOut(req, res) {
  try {
    const checkpointId = Number(req.params.checkpointId);
    const workerId = req.user.id;
    const { notes } = req.body;
    const session = await workSessionService.checkOut(checkpointId, workerId, notes);
    return res.json({ message: 'Checked out', data: session });
  } catch (err) {
    if (err.message === 'NO_OPEN_SESSION') return res.status(400).json({ message: 'No active session to check out from' });
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getSessions(req, res) {
  try {
    const checkpointId = Number(req.params.checkpointId);
    const sessions = await workSessionService.getSessionsByCheckpoint(checkpointId);
    const totalMinutes = await workSessionService.getTotalTime(checkpointId);
    const activeSession = await workSessionService.getActiveSession(checkpointId, req.user.id);
    return res.json({ data: { sessions, totalMinutes, activeSession } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { checkIn, checkOut, getSessions };
