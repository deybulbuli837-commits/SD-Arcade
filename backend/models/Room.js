import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const roomSchema = new mongoose.Schema({
  roomId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  inviteCode: { 
    type: String, 
    required: true, 
    unique: true 
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    unique: true // A user can only host one room at a time
  },
  joinerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  },
  messages: [messageSchema],
  selectedRomHash: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
});

const Room = mongoose.model('Room', roomSchema);
export default Room;
