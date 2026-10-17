import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { mongoClient } from '../database/mongodb.connection';
import { logger } from '../utils/logger';

let io: SocketIOServer | null = null;
const roomViewers: Map<string, Set<string>> = new Map();

export const initChatSocket = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    path: '/api/live/socket.io'
  });

  io.on('connection', (socket: Socket) => {
    logger.debug(`Live socket connected: ${socket.id}`);

    // Join channel live room
    socket.on('join_channel', async ({ channelId, username, userId }) => {
      socket.join(channelId);
      (socket as any).channelId = channelId;
      (socket as any).username = username || 'Viewer';
      (socket as any).userId = userId || socket.id;

      if (!roomViewers.has(channelId)) {
        roomViewers.set(channelId, new Set());
      }
      roomViewers.get(channelId)!.add(socket.id);

      const viewerCount = roomViewers.get(channelId)!.size;

      // Broadcast updated viewer count
      io?.to(channelId).emit('viewer_count', {
        channelId,
        count: viewerCount
      });

      // Send recent chat history
      try {
        const db = mongoClient.db('ott_platform');
        const history = await db.collection('live_chat_messages')
          .find({ channelId })
          .sort({ timestamp: -1 })
          .limit(40)
          .toArray();

        socket.emit('chat_history', history.reverse());
      } catch (err) {
        logger.error('Error fetching chat history:', err);
      }
    });

    // Send chat message
    socket.on('send_message', async ({ channelId, message, username, userId, userRole }) => {
      if (!channelId || !message || message.trim().length === 0) return;

      const chatMsg = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        channelId,
        message: message.trim().slice(0, 500),
        username: username || 'Viewer',
        userId: userId || socket.id,
        userRole: userRole || 'viewer',
        timestamp: new Date().toISOString()
      };

      // Broadcast message to everyone in the channel
      io?.to(channelId).emit('new_message', chatMsg);

      // Persist to MongoDB asynchronously
      try {
        const db = mongoClient.db('ott_platform');
        await db.collection('live_chat_messages').insertOne(chatMsg);
      } catch (err) {
        logger.error('Error saving chat message:', err);
      }
    });

    // Send live reaction (heart, fire, clap, 4K)
    socket.on('send_reaction', ({ channelId, reaction, username }) => {
      io?.to(channelId).emit('live_reaction', {
        channelId,
        reaction,
        username,
        id: Math.random().toString(36).substring(2, 9)
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      const channelId = (socket as any).channelId;
      if (channelId && roomViewers.has(channelId)) {
        roomViewers.get(channelId)!.delete(socket.id);
        const viewerCount = roomViewers.get(channelId)!.size;
        io?.to(channelId).emit('viewer_count', {
          channelId,
          count: viewerCount
        });
      }
    });
  });

  logger.info('Live WebSocket Chat & Viewer presence engine initialized');
  return io;
};

export const broadcastLiveEvent = (eventName: string, data: any): void => {
  if (io) {
    io.emit(eventName, data);
  }
};
