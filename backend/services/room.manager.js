const { supabase } = require('../config/supabase');

class RoomManager {
    constructor() {
        this.io = null;
        this.activeRooms = new Map(); // Memory Cache: Map<roomId, roomSnapshot>
        this.socketToUser = new Map();
        this.userToSocket = new Map();
        this.heartbeats = new Map(); // lastHeartbeat[userId] = Date.now()
    }

    init(io) {
        this.io = io;
        console.log('🏛️ Enterprise RoomManager Initialized');
        // Watchdog: Check stale users/rooms every 15 sec
        setInterval(() => this.runWatchdog(), 15 * 1000);
    }

    async getOrLoadRoom(roomId) {
        if (this.activeRooms.has(roomId)) return this.activeRooms.get(roomId);
        
        const { data: room, error } = await supabase.from('public_rooms').select('*').eq('id', roomId).single();
        if (!room) return null;

        const snapshot = {
            id: room.id, code: room.room_code, hostId: room.host_id,
            status: room.status, timerType: room.timer_type,
            currentMatch: room.status === 'MATCH_RUNNING',
            lastActivity: Date.now()
        };
        this.activeRooms.set(roomId, snapshot);
        return snapshot;
    }

    async createPublicRoom(hostId, timerType) {
        const roomCode = 'PX-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        const { data: room, error } = await supabase.from('public_rooms').insert({
            room_code: roomCode, host_id: hostId, timer_type: timerType, status: 'ACTIVE', current_players: 1
        }).select().single();

        if (error) {
            console.error('❌ Create Room Error:', error);
            return null;
        }

        const snapshot = {
            id: room.id, code: roomCode, hostId, status: 'ACTIVE', 
            timerType, currentMatch: false, lastActivity: Date.now()
        };
        this.activeRooms.set(room.id, snapshot);
        return room;
    }

    async joinRoom(roomId, userId, socket, deviceId) {
        const room = await this.getOrLoadRoom(roomId);
        if (!room) return { success: false, message: 'Room not found' };

        // Host bypass: Hosts should not be in the queue list
        if (room.hostId === userId) {
            socket.join(`room_${roomId}`);
            this.socketToUser.set(socket.id, userId);
            this.userToSocket.set(userId, socket.id);
            await this.broadcastRoomUpdate(roomId);
            return { success: true, message: 'Host joined' };
        }

        const { data: res, error } = await supabase.rpc('join_public_room_atomic', { 
            p_room_id: roomId, p_user_id: userId, p_socket_id: socket.id, p_device_id: deviceId 
        });

        if (error) {
            console.error('❌ RPC join_public_room_atomic Error:', error);
            return { success: false, message: `DB Error: ${error.message || 'Unknown'}` };
        }

        if (!res?.success) {
            console.warn('⚠️ RPC join_public_room_atomic Failed:', res);
            return { success: false, message: res?.message || 'Join failed' };
        }

        socket.join(`room_${roomId}`);
        this.socketToUser.set(socket.id, userId);
        this.userToSocket.set(userId, socket.id);
        
        await this.broadcastRoomUpdate(roomId);
        return { success: true };
    }

    async handleHeartbeat(userId) {
        this.heartbeats.set(userId, Date.now());
    }

    async broadcastRoomUpdate(roomId) {
        try {
            // Fetch source of truth (PostgreSQL)
            const { data: roomData } = await supabase.from('public_rooms')
                .select('*, profiles:host_id(username, profile_image)')
                .eq('id', roomId).single();
            
            if (!roomData) return;

            const { data: players } = await supabase.from('public_room_players')
                .select('user_id, queue_pos, status, profiles:user_id(username, profile_image)')
                .eq('room_id', roomId)
                .order('queue_pos', { ascending: true });

            const snapshot = {
                roomId: roomData.id,
                roomCode: roomData.room_code,
                status: roomData.status,
                currentPlayers: (players || []).length + 1,
                maxPlayers: roomData.max_players,
                host: {
                    userId: roomData.host_id,
                    username: roomData.profiles?.username || 'Host',
                    profileImage: roomData.profiles?.profile_image
                },
                players: (players || []).map(p => ({
                    userId: p.user_id,
                    username: p.profiles?.username || 'Player',
                    profileImage: p.profiles?.profile_image,
                    queuePos: p.queue_pos,
                    status: p.status
                }))
            };

            // Update Cache
            this.activeRooms.set(roomId, {
                ...this.activeRooms.get(roomId),
                status: roomData.status,
                lastActivity: Date.now()
            });

            this.io.to(`room_${roomId}`).emit('public_room_sync', snapshot);
        } catch (err) {
            console.error('broadcastRoomUpdate error:', err);
        }
    }

    async updateRoomStatus(roomId, status) {
        const room = await this.getOrLoadRoom(roomId);
        if (!room) return;

        await supabase.from('public_rooms').update({ status }).eq('id', roomId);
        room.status = status;
        await this.broadcastRoomUpdate(roomId);
    }

    async runWatchdog() {
        const now = Date.now();
        
        // 1. Check for stale host (30s grace period)
        for (const [roomId, room] of this.activeRooms.entries()) {
            const hostHeartbeat = this.heartbeats.get(room.hostId);
            if (!hostHeartbeat || (now - hostHeartbeat > 30000)) {
                if (room.status !== 'HOST_OFFLINE' && room.status !== 'CLOSED') {
                    console.log(`⚠️ Host ${room.hostId} stale for room ${roomId}`);
                    await this.updateRoomStatus(roomId, 'HOST_OFFLINE');
                }
                // If stale for too long (120s), close room
                if (hostHeartbeat && (now - hostHeartbeat > 120000)) {
                    await this.closeRoom(roomId);
                }
            } else if (room.status === 'HOST_OFFLINE') {
                // Host came back
                await this.updateRoomStatus(roomId, 'ACTIVE');
            }
        }
    }

    async closeRoom(roomId) {
        await supabase.from('public_rooms').update({ status: 'CLOSED' }).eq('id', roomId);
        this.io.to(`room_${roomId}`).emit('public_room_closed', { reason: 'HOST_OFFLINE' });
        this.activeRooms.delete(roomId);
    }

    async handleMatchEnd(roomId, guestUserId) {
        console.log(`[RoomManager] handleMatchEnd: Room=${roomId}, Guest=${guestUserId}`);
        
        // 1. Nuclear Cleanup: Remove anyone marked as 'playing' in this room
        // This is safe because only one player can be 'playing' with the host at a time.
        await supabase.from('public_room_players').delete().eq('room_id', roomId).eq('status', 'playing');

        // 2. Force remove the specific guest (Redundant)
        await supabase.from('public_room_players').delete().eq('room_id', roomId).eq('user_id', guestUserId);

        // 3. Call RPC to shift remaining queue positions
        const { error: rpcErr } = await supabase.rpc('leave_public_room_atomic', { p_room_id: roomId, p_user_id: guestUserId });
        if (rpcErr) console.error('[RoomManager] RPC leave error:', rpcErr);
        
        // 4. Notify the guest to exit the lobby page
        const socketId = this.userToSocket.get(guestUserId);
        if (socketId) {
            console.log(`[RoomManager] Redirecting guest ${guestUserId}`);
            this.io.to(socketId).emit('public_room_closed', { message: 'Match finished! Thanks for playing. Return to lobby list to join again.' });
        }

        // 4. Set room back to active
        await supabase.from('public_rooms').update({ status: 'ACTIVE' }).eq('id', roomId);
        
        await this.broadcastRoomUpdate(roomId);
    }
}

module.exports = new RoomManager();
