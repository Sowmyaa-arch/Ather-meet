import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Video,
  Plus,
  Calendar,
  Keyboard,
  Clock,
  Copy,
  Check,
  Shield,
  ArrowRight,
  ExternalLink,
  Home,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Navbar } from '../components/Navbar';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
  const [meetingCode, setMeetingCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleWaitingRoom, setScheduleWaitingRoom] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMeetings() {
      try {
        const data = await api.getUserMeetings();
        setRecentMeetings(data.meetings || []);
      } catch (err) {
        console.warn('Error loading recent meetings:', err);
      }
    }
    loadMeetings();
  }, []);

  const handleInstantMeeting = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const data = await api.createMeeting({
        title: `${user?.name || 'User'}'s Meeting`,
        waitingRoomEnabled: false,
      });
      navigate(`/meet/${data.meeting.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create meeting');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateScheduledMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTitle.trim()) return;
    try {
      const data = await api.createMeeting({
        title: scheduleTitle.trim(),
        waitingRoomEnabled: scheduleWaitingRoom,
      });
      setIsScheduling(false);
      setScheduleTitle('');
      setRecentMeetings(prev => [data.meeting, ...prev]);
      navigate(`/meet/${data.meeting.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to schedule meeting');
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    let code = meetingCode.trim();
    if (!code) return;
    if (code.includes('/meet/')) {
      code = code.split('/meet/')[1].split('?')[0];
    }
    navigate(`/meet/${code}`);
  };

  const handleCopyLink = (id: string) => {
    const link = `${window.location.origin}/meet/${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Breadcrumb / Return to Home */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-white px-3.5 py-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 hover:bg-gray-850 transition-all shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-brand-400" />
            <span>Back to Home</span>
          </Link>
          <div className="text-xs text-gray-500 font-medium hidden sm:block">
            Dashboard & Meeting Hub
          </div>
        </div>

        {/* Welcome Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-gray-900 via-brand-950/40 to-gray-900 border border-gray-800 shadow-xl">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Welcome back, {user?.name || 'Friend'} 👋
            </h1>
            <p className="text-sm text-gray-400">
              Create a new secure meeting or join an existing conference room with one click.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="px-4 py-3 rounded-xl bg-gray-800/80 hover:bg-gray-800 text-gray-200 hover:text-white font-medium text-sm border border-gray-700/80 flex items-center gap-2 transition-all shadow-sm"
            >
              <Home className="w-4 h-4 text-gray-400" />
              <span>Home</span>
            </Link>
            <button
              onClick={handleInstantMeeting}
              disabled={isCreating}
              className="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 flex items-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreating ? 'Creating Room...' : 'Start Instant Meeting'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Start Instant */}
          <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">New Meeting</h3>
              <p className="text-xs text-gray-400">
                Generate a fresh room with a cryptographically secure random link ready to share.
              </p>
            </div>
            <button
              onClick={handleInstantMeeting}
              disabled={isCreating}
              className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-brand-600 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Instant Launch</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2: Join by code */}
          <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Keyboard className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Join with Code</h3>
              <p className="text-xs text-gray-400">
                Enter a meeting ID (e.g. abc-defg-hij) or paste a shared invitation link.
              </p>
            </div>
            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                type="text"
                value={meetingCode}
                onChange={e => setMeetingCode(e.target.value)}
                placeholder="Meeting code"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={!meetingCode.trim()}
                className="px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-medium text-xs transition-colors"
              >
                Join
              </button>
            </form>
          </div>

          {/* Card 3: Schedule Meeting */}
          <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Schedule Meeting</h3>
              <p className="text-xs text-gray-400">
                Plan a future conference, customize room title, and enable host waiting room.
              </p>
            </div>
            <button
              onClick={() => setIsScheduling(true)}
              className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-purple-600 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Schedule Details</span>
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Schedule Modal */}
        {isScheduling && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-semibold text-white">Schedule a Meeting</h3>
              <form onSubmit={handleCreateScheduledMeeting} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Meeting Topic / Title
                  </label>
                  <input
                    type="text"
                    required
                    value={scheduleTitle}
                    onChange={e => setScheduleTitle(e.target.value)}
                    placeholder="Weekly Engineering Sync"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/60 border border-gray-700">
                  <input
                    type="checkbox"
                    id="waitingRoomCheck"
                    checked={scheduleWaitingRoom}
                    onChange={e => setScheduleWaitingRoom(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded bg-gray-700 border-gray-600 focus:ring-brand-500"
                  />
                  <label htmlFor="waitingRoomCheck" className="text-xs text-gray-300 cursor-pointer">
                    Enable Waiting Room (Host must admit participants before they enter)
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsScheduling(false)}
                    className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md transition-colors"
                  >
                    Create & Launch
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Meeting History Table */}
        <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-400" /> Recent Meetings
            </h2>
            <span className="text-xs text-gray-400">{recentMeetings.length} records</span>
          </div>

          {recentMeetings.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="text-sm">No recent meetings found.</p>
              <p className="text-xs text-gray-500 mt-1">
                Start an instant meeting above to test audio, video, and screen sharing!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/80">
              {recentMeetings.map(m => (
                <div
                  key={m.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-850/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-100">{m.title}</span>
                      {m.waitingRoomEnabled && (
                        <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium">
                          Waiting Room
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="font-mono text-gray-300">{m.id}</span>
                      <span>•</span>
                      <span>{new Date(m.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(m.id)}
                      className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors border border-gray-700"
                      title="Copy meeting link"
                    >
                      {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === m.id ? 'Copied' : 'Copy Link'}</span>
                    </button>
                    <button
                      onClick={() => navigate(`/meet/${m.id}`)}
                      className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <span>Join Room</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
