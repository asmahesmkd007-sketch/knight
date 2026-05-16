"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useSocket } from "@/hooks/useSocket";
import { UserAPI, GameAPI } from "@/lib/api";
import { 
  Flag, 
  RotateCcw, 
  MessageSquare, 
  Send, 
  Clock, 
  Brain, 
  Trophy,
  User as UserIcon,
  Wifi,
  WifiOff
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs) => twMerge(clsx(inputs));

export default function GamePage() {
  const { matchId } = useParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { socket, isConnected } = useSocket(user?.id);
  const [game, setGame] = useState(new Chess());
  const [myColor, setMyColor] = useState("w");
  const [opponent, setOpponent] = useState(null);
  const [timers, setTimers] = useState({ me: 300, opp: 300 });
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const chatRef = useRef(null);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("px_user"));
    if (!storedUser) {
      router.push("/login");
      return;
    }
    setUser(storedUser);

    const matchData = JSON.parse(localStorage.getItem("px_match") || "{}");
    setMyColor(matchData.color === "black" ? "b" : "w");
    setOpponent(matchData.opponent);
    setTimers({ me: (matchData.timer || 5) * 60, opp: (matchData.timer || 5) * 60 });
  }, [router]);

  useEffect(() => {
    if (!socket || !matchId) return;

    socket.emit("join_match", { matchId });

    socket.on("move_made", (move) => {
      setGame(prev => {
        const newGame = new Chess(prev.fen());
        newGame.move(move);
        return newGame;
      });
    });

    socket.on("timer_update", (data) => {
      setTimers({
        me: myColor === "w" ? data.wTime : data.bTime,
        opp: myColor === "w" ? data.bTime : data.wTime
      });
    });

    socket.on("chat_message", (msg) => {
      setChat(prev => [...prev, msg]);
    });

    return () => {
      socket.off("move_made");
      socket.off("timer_update");
      socket.off("chat_message");
    };
  }, [socket, matchId, myColor]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chat]);

  function onDrop(sourceSquare, targetSquare) {
    const move = {
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    };

    try {
      const newGame = new Chess(game.fen());
      const result = newGame.move(move);
      if (result) {
        setGame(newGame);
        socket.emit("make_move", { matchId, move });
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit("send_chat", { matchId, message: input });
    setChat(prev => [...prev, { senderId: user.id, message: input, senderName: user.username }]);
    setInput("");
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 flex flex-col lg:grid lg:grid-cols-12 gap-8">
      {/* Game Header */}
      <div className="lg:col-span-12 flex items-center justify-between bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-subtle)] mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-bold uppercase">
            <span className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
            {isConnected ? "Live Connection" : "Reconnecting..."}
          </div>
          <h1 className="font-space text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Match #{matchId?.slice(-6)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl text-xs font-bold transition-all">
            <Flag size={14} />
            Resign
          </button>
        </div>
      </div>

      {/* Chess Board Section */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Opponent Bar */}
        <div className={cn(
          "flex items-center justify-between p-4 bg-[var(--bg-card)] rounded-2xl border transition-all duration-300",
          game.turn() !== myColor ? "border-[var(--gold)]/40 shadow-[0_0_20px_rgba(212,168,67,0.1)]" : "border-[var(--border-subtle)]"
        )}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-center text-[var(--gold)] font-bold text-xl">
              {opponent?.profile_image ? <img src={opponent.profile_image} className="w-full h-full object-cover rounded-xl" /> : (opponent?.username?.[0].toUpperCase() || "?")}
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)]">{opponent?.full_name || opponent?.username || "Opponent"}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-white/5 px-2 py-0.5 rounded text-[10px] text-[var(--text-muted)] font-bold uppercase">{opponent?.rank || "Bronze"}</span>
                <span className="flex items-center gap-1 text-[10px] text-[var(--gold)] font-bold"><Brain size={10} /> IQ {opponent?.iq_level || 100}</span>
              </div>
            </div>
          </div>
          <div className={cn(
            "font-space text-2xl font-black transition-colors",
            timers.opp < 30 ? "text-red-500 animate-pulse" : "text-[var(--text-primary)]"
          )}>
            {formatTime(timers.opp)}
          </div>
        </div>

        {/* The Board */}
        <div className="aspect-square bg-[var(--bg-sunken)] rounded-2xl p-2 shadow-2xl border border-white/5 overflow-hidden">
          <Chessboard 
            position={game.fen()} 
            onPieceDrop={onDrop} 
            boardOrientation={myColor === "w" ? "white" : "black"}
            customDarkSquareStyle={{ backgroundColor: "#1e1e27" }}
            customLightSquareStyle={{ backgroundColor: "#2d2d3a" }}
            customPieces={{
              // Custom pieces could be added here for more premium look
            }}
          />
        </div>

        {/* Player Bar */}
        <div className={cn(
          "flex items-center justify-between p-4 bg-[var(--bg-card)] rounded-2xl border transition-all duration-300",
          game.turn() === myColor ? "border-[var(--gold)]/40 shadow-[0_0_20px_rgba(212,168,67,0.1)]" : "border-[var(--border-subtle)]"
        )}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] font-bold text-xl shadow-lg">
              {user?.profile_image ? <img src={user.profile_image} className="w-full h-full object-cover rounded-xl" /> : (user?.username?.[0].toUpperCase() || "P")}
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)]">{user?.full_name || user?.username || "You"} (You)</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-[var(--gold)] text-black px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">{user?.rank}</span>
                <span className="flex items-center gap-1 text-[10px] text-[var(--gold)] font-bold"><Brain size={10} /> IQ {user?.iq_level}</span>
              </div>
            </div>
          </div>
          <div className={cn(
            "font-space text-2xl font-black transition-colors",
            timers.me < 30 ? "text-red-500 animate-pulse" : "text-[var(--text-primary)]"
          )}>
            {formatTime(timers.me)}
          </div>
        </div>
      </div>

      {/* Side Panels */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        {/* Chat Panel */}
        <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl flex flex-col overflow-hidden min-h-[400px]">
          <div className="p-4 border-b border-[var(--border-subtle)] flex items-center gap-2 bg-white/5">
            <MessageSquare size={16} className="text-[var(--gold)]" />
            <h3 className="font-space text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">In-Game Chat</h3>
          </div>
          <div ref={chatRef} className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-hide">
            <div className="text-[10px] text-[var(--text-muted)] text-center py-2 font-bold uppercase tracking-wider opacity-50">Match started. Good luck!</div>
            {chat.map((msg, i) => (
              <div key={i} className={cn(
                "flex flex-col max-w-[85%]",
                msg.senderId === user?.id ? "ml-auto items-end" : "items-start"
              )}>
                <div className="text-[9px] font-bold text-[var(--text-muted)] mb-1 px-1">{msg.senderName}</div>
                <div className={cn(
                  "p-3 rounded-2xl text-[13px] leading-relaxed",
                  msg.senderId === user?.id 
                    ? "bg-[var(--gold)] text-black rounded-tr-none font-medium" 
                    : "bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-tl-none"
                )}>
                  {msg.message}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendChat} className="p-4 bg-white/5 border-t border-[var(--border-subtle)] flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 text-sm focus:border-[var(--gold)] transition-all"
            />
            <button className="bg-[var(--gold)] text-black w-10 h-10 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg">
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Move History */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden h-[240px] flex flex-col">
          <div className="p-4 border-b border-[var(--border-subtle)] flex items-center gap-2 bg-white/5">
            <RotateCcw size={16} className="text-[var(--gold)]" />
            <h3 className="font-space text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">Move History</h3>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2 overflow-y-auto">
            {game.history().map((move, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-5 text-[var(--text-muted)] font-mono">{Math.floor(i / 2) + 1}.</span>
                <span className="font-bold text-[var(--text-primary)] bg-white/5 px-2 py-1 rounded border border-white/5 flex-1">{move}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
