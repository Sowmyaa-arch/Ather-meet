import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  BarChart3,
  Plus,
  ChevronDown,
  Check,
  Lock,
  Trash2,
  Vote,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
import { PollData } from '../types';

interface PollDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  polls: PollData[];
  pollError: string | null;
  onCreatePoll: (question: string, options: string[]) => void;
  onVotePoll: (pollId: string, optionId: string) => void;
  onClosePoll: (pollId: string) => void;
}

export const PollDrawer: React.FC<PollDrawerProps> = ({
  isOpen,
  onClose,
  isHost,
  polls,
  pollError,
  onCreatePoll,
  onVotePoll,
  onClosePoll,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [optionTexts, setOptionTexts] = useState(['', '']);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [polls.length, isOpen]);

  const handleAddOption = () => {
    if (optionTexts.length >= 8) return;
    setOptionTexts(prev => [...prev, '']);
  };

  const handleRemoveOption = (idx: number) => {
    if (optionTexts.length <= 2) return;
    setOptionTexts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleOptionChange = (idx: number, value: string) => {
    setOptionTexts(prev => prev.map((o, i) => (i === idx ? value : o)));
  };

  const handleSubmitPoll = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQ = question.trim();
    const trimmedOptions = optionTexts.map(o => o.trim()).filter(o => o.length > 0);
    if (!trimmedQ || trimmedOptions.length < 2) return;

    onCreatePoll(trimmedQ, trimmedOptions);
    setQuestion('');
    setOptionTexts(['', '']);
    setIsCreating(false);
  };

  const sortedPolls = [...polls].sort((a, b) => {
    // Active polls first, then newest first
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div
      className={clsx(
        'absolute right-0 top-0 bottom-0 w-full sm:w-[380px] bg-gray-950/95 backdrop-blur-xl border-l border-gray-800/80 z-30 flex flex-col transition-transform duration-300 ease-out',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Polls</h3>
            <p className="text-[10px] text-gray-500">{polls.length} poll{polls.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Poll Error */}
      {pollError && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {pollError}
        </div>
      )}

      {/* Create Poll Button (Host Only) */}
      {isHost && !isCreating && (
        <div className="px-4 pt-4">
          <button
            onClick={() => setIsCreating(true)}
            className="w-full py-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:text-purple-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Poll</span>
          </button>
        </div>
      )}

      {/* Create Poll Form */}
      {isHost && isCreating && (
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-gray-900 border border-gray-800 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              New Poll
            </h4>
            <button
              onClick={() => {
                setIsCreating(false);
                setQuestion('');
                setOptionTexts(['', '']);
              }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmitPoll} className="space-y-3">
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              maxLength={500}
              className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              autoFocus
            />

            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Options
              </label>
              {optionTexts.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] text-gray-400 font-bold shrink-0">
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <input
                    type="text"
                    value={opt}
                    onChange={e => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    maxLength={200}
                    className="flex-1 bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  {optionTexts.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-1 rounded-md text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {optionTexts.length < 8 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="w-full py-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 text-[10px] text-gray-400 hover:text-gray-200 font-medium flex items-center justify-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Option
              </button>
            )}

            <button
              type="submit"
              disabled={!question.trim() || optionTexts.filter(o => o.trim()).length < 2}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Vote className="w-3.5 h-3.5" />
              Launch Poll
            </button>
          </form>
        </div>
      )}

      {/* Polls List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-800">
        {sortedPolls.length === 0 && !isCreating && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-600">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-400">No Polls Yet</p>
              <p className="text-xs text-gray-500 max-w-[220px]">
                {isHost
                  ? 'Create a poll to engage participants and gather instant feedback.'
                  : 'The host hasn\'t created any polls yet.'}
              </p>
            </div>
          </div>
        )}

        {sortedPolls.map(poll => (
          <PollCard
            key={poll.id}
            poll={poll}
            isHost={isHost}
            onVote={onVotePoll}
            onClose={onClosePoll}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// Individual Poll Card
// ---------------------------------------------------------

interface PollCardProps {
  poll: PollData;
  isHost: boolean;
  onVote: (pollId: string, optionId: string) => void;
  onClose: (pollId: string) => void;
}

const PollCard: React.FC<PollCardProps> = ({ poll, isHost, onVote, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasVoted = !!poll.userVotedOptionId;
  const showResults = hasVoted || !poll.isActive;

  const getPercentage = (votes: number) => {
    if (poll.totalVotes === 0) return 0;
    return Math.round((votes / poll.totalVotes) * 100);
  };

  const getBarColor = (optionId: string, idx: number) => {
    if (poll.userVotedOptionId === optionId) return 'bg-purple-500';
    const colors = ['bg-brand-500', 'bg-indigo-500', 'bg-teal-500', 'bg-amber-500', 'bg-pink-500', 'bg-cyan-500', 'bg-lime-500', 'bg-rose-500'];
    return colors[idx % colors.length];
  };

  return (
    <div className={clsx(
      'rounded-2xl border overflow-hidden transition-all',
      poll.isActive
        ? 'bg-gray-900/80 border-purple-500/30 shadow-lg shadow-purple-500/5'
        : 'bg-gray-900/60 border-gray-800/60 opacity-80'
    )}>
      {/* Poll Header */}
      <div
        className="px-4 py-3 flex items-start justify-between cursor-pointer"
        onClick={() => setIsCollapsed(prev => !prev)}
      >
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            {poll.isActive ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-800 border border-gray-700 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                <Lock className="w-2.5 h-2.5" />
                Closed
              </span>
            )}
            <span className="text-[10px] text-gray-500 truncate">
              by {poll.creatorName}
            </span>
          </div>
          <p className="text-sm font-semibold text-white leading-snug pr-2">
            {poll.question}
          </p>
          <p className="text-[10px] text-gray-500">
            {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
          </p>
        </div>
        <ChevronDown
          className={clsx(
            'w-4 h-4 text-gray-500 shrink-0 transition-transform mt-1',
            isCollapsed && 'rotate-180'
          )}
        />
      </div>

      {/* Poll Options */}
      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-2 animate-fadeIn">
          {poll.options.map((opt, idx) => {
            const pct = getPercentage(opt.votes);
            const isSelected = poll.userVotedOptionId === opt.id;

            return (
              <button
                key={opt.id}
                onClick={() => {
                  if (poll.isActive && !hasVoted) {
                    onVote(poll.id, opt.id);
                  }
                }}
                disabled={!poll.isActive || hasVoted}
                className={clsx(
                  'w-full relative rounded-xl px-3.5 py-2.5 text-left transition-all overflow-hidden group',
                  poll.isActive && !hasVoted
                    ? 'bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 hover:border-purple-500/40 cursor-pointer'
                    : 'bg-gray-800/40 border border-gray-700/40 cursor-default'
                )}
              >
                {/* Progress bar fill */}
                {showResults && (
                  <div
                    className={clsx(
                      'absolute inset-0 opacity-20 transition-all duration-700 ease-out rounded-xl',
                      getBarColor(opt.id, idx)
                    )}
                    style={{ width: `${pct}%` }}
                  />
                )}

                <div className="relative flex items-center justify-between gap-2 z-10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Option letter badge */}
                    <div className={clsx(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors',
                      isSelected
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-700/80 text-gray-400'
                    )}>
                      {isSelected ? <Check className="w-3 h-3" /> : String.fromCharCode(65 + idx)}
                    </div>
                    <span className={clsx(
                      'text-xs truncate',
                      isSelected ? 'text-purple-200 font-semibold' : 'text-gray-200'
                    )}>
                      {opt.text}
                    </span>
                  </div>

                  {showResults && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-bold text-white">{pct}%</span>
                      <span className="text-[9px] text-gray-500">({opt.votes})</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {/* Host Close Poll Button */}
          {isHost && poll.isActive && (
            <button
              onClick={() => onClose(poll.id)}
              className="w-full py-2 rounded-xl bg-gray-800/60 hover:bg-rose-600/20 border border-gray-700/50 hover:border-rose-500/30 text-[10px] font-semibold text-gray-400 hover:text-rose-300 flex items-center justify-center gap-1.5 transition-all mt-1"
            >
              <Lock className="w-3 h-3" />
              End Voting
            </button>
          )}

          {/* Vote confirmation */}
          {hasVoted && poll.isActive && (
            <p className="text-[10px] text-emerald-400 text-center flex items-center justify-center gap-1 pt-0.5">
              <Check className="w-3 h-3" /> Your vote has been recorded
            </p>
          )}
        </div>
      )}
    </div>
  );
};
