import express from 'express';
import Room from '../models/Room.js';
import { protect } from '../middlewares/authMiddleware.js';
import crypto from 'crypto';

const router = express.Router();

// Get active rooms for the user (hosted or joined)
router.get('/', protect, async (req, res) => {
  try {
    const rooms = await Room.find({
      $or: [{ hostId: req.user._id }, { joinerId: req.user._id }]
    }).populate('hostId', 'username').populate('joinerId', 'username');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new room
router.post('/', protect, async (req, res) => {
  try {
    // Check if user already hosts a room
    const existing = await Room.findOne({ hostId: req.user._id });
    if (existing) {
      return res.status(400).json({ message: 'You already have an active room. Please delete it first.' });
    }

    const roomId = crypto.randomUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const room = new Room({
      roomId,
      inviteCode,
      hostId: req.user._id
    });

    await room.save();
    
    // Populate hostId before returning
    await room.populate('hostId', 'username');
    
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Join a room via invite code
router.post('/join', protect, async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ message: 'Invite code required' });

  try {
    const room = await Room.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (room.hostId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot join your own room. Launch it from the dashboard.' });
    }

    if (room.joinerId && room.joinerId.toString() !== req.user._id.toString()) {
      return res.status(400).json({ message: 'Room is already full' });
    }

    // Assign joiner
    if (!room.joinerId) {
      room.joinerId = req.user._id;
      await room.save();
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a room (only host can do this)
router.delete('/:roomId', protect, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (room.hostId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the host can delete this room' });
    }

    await Room.deleteOne({ roomId: req.params.roomId });
    res.json({ message: 'Room deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Leave a room (joiner only)
router.post('/:roomId/leave', protect, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (room.joinerId && room.joinerId.toString() === req.user._id.toString()) {
      room.joinerId = null;
      await room.save();
      return res.json({ message: 'Left room' });
    }

    res.status(400).json({ message: 'You are not the joiner of this room' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
