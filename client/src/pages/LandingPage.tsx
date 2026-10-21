import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Video, Keyboard, Shield, Users, Monitor, Lock, Sparkles, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Navbar } from '../components/Navbar';

export const LandingPage: React.FC = () => {
  const [meetingCode, setMeetingCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, demoLogin } = useAuth();
  const navigate = useNavigate();

  const handleCreateMeeting = async () => {
    setIsCreating(true);
    setError(null);
    try {
      // If user not signed in, seamlessly log in as demo host so they can start right away!
      if (!user) {
        await demoLogin('host');
      }
      const data = await api.createMeeting({ title: 'Quick Conference' });
      navigate(`/meet/${data.meeting.id}`);
    } catch (err: any) {
      setError(err.message || 'Could not create meeting');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    let code = meetingCode.trim();
    if (!code) return;

    // Support full URLs e.g. https://domain.com/meet/abc-defg-hij
    if (code.includes('/meet/')) {
      code = code.split('/meet/')[1].split('?')[0].split('/')[0];
    }
    navigate(`/meet/${code}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Headlines & Actions */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <span>Next-Generation Real-Time WebRTC Video</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Secure Video Calls. <br />
              <span className="bg-gradient-to-r from-brand-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                Crystal Clear & Instant.
              </span>
            </h1>

            <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
              Experience seamless, room-isolated video conferencing with multi-party WebRTC, in-meeting chat, host-controlled waiting rooms, and screen sharing with zero app downloads.
            </p>

            {/* Quick Actions Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={handleCreateMeeting}
                disabled={isCreating}
                className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-base shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all hover:-translate-y-0.5 disabled:opacity-50 shrink-0"
              >
                <Video className="w-5 h-5" />
                <span>{isCreating ? 'Creating Room...' : 'New Meeting'}</span>
              </button>

              <Link
                to="/dashboard"
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 hover:text-white font-semibold text-sm transition-all hover:-translate-y-0.5 shadow-sm shrink-0"
              >
                <LayoutDashboard className="w-4 h-4 text-brand-400" />
                <span>Dashboard</span>
              </Link>

              <form onSubmit={handleJoinMeeting} className="flex-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <Keyboard className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={meetingCode}
                    onChange={e => setMeetingCode(e.target.value)}
                    placeholder="Enter meeting code or link"
                    className="w-full pl-11 pr-4 py-3.5 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!meetingCode.trim()}
                  className="px-5 py-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 font-semibold text-sm transition-colors border border-gray-700 shrink-0"
                >
                  Join
                </button>
              </form>
            </div>

            {error && (
              <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl">
                {error}
              </p>
            )}

            {/* Feature Bullets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-800/80">
              <div className="flex items-center gap-2.5 text-xs text-gray-400">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Strict Room Isolation</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-gray-400">
                <Shield className="w-4 h-4 text-brand-400" />
                <span>Host Waiting Rooms</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-gray-400">
                <Monitor className="w-4 h-4 text-indigo-400" />
                <span>HD Screen Sharing</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Showcase Mockup */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto w-full max-w-md lg:max-w-none rounded-3xl p-3 bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700/80 shadow-2xl overflow-hidden">
              <div className="rounded-2xl bg-gray-950 p-4 border border-gray-800/80 space-y-3">
                {/* Simulated meeting top bar */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-800 text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-gray-200">AetherMeet Live Room</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-mono text-[11px]">
                    abc-defg-hij
                  </span>
                </div>

                {/* Simulated 2-Peer Grid */}
                <div className="grid grid-cols-2 gap-2.5 aspect-video">
                  <div className="rounded-xl bg-gradient-to-tr from-brand-900/60 to-indigo-900/40 border border-brand-500/30 flex flex-col items-center justify-center p-3 relative overflow-hidden">
                    <div className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                      JD
                    </div>
                    <span className="text-[11px] font-medium text-gray-200 mt-2">Jordan Doe (Host)</span>
                    <span className="absolute bottom-2 left-2 text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Speaking</span>
                  </div>

                  <div className="rounded-xl bg-gradient-to-tr from-purple-900/60 to-pink-900/40 border border-purple-500/30 flex flex-col items-center justify-center p-3 relative overflow-hidden">
                    <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                      AR
                    </div>
                    <span className="text-[11px] font-medium text-gray-200 mt-2">Alex River</span>
                    <span className="absolute bottom-2 right-2 text-[9px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">1080p</span>
                  </div>
                </div>

                {/* Simulated controls bar */}
                <div className="flex items-center justify-center gap-2 pt-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-gray-300">
                    <Video className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-gray-300">
                    <Monitor className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
