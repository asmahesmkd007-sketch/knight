const { supabase } = require('../config/supabase');
const RoomManager = require('../services/room.manager');

exports.createRoom = async (req, res) => {
    try {
        const { timerType } = req.body;
        const hostId = req.user.id;

        const room = await RoomManager.createPublicRoom(hostId, timerType);
        if (!room) return res.status(500).json({ success: false, message: 'Failed to create room' });

        res.json({ success: true, room });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getRoomByCode = async (req, res) => {
    try {
        const { code } = req.params;
        const { data: room, error } = await supabase.from('public_rooms')
            .select('*, profiles:host_id(username, profile_image)')
            .eq('room_code', code).single();

        if (error || !room) return res.status(404).json({ success: false, message: 'Room not found' });
        res.json({ success: true, room });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
