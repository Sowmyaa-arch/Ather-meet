import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, Home, ArrowLeft, Star, CheckCircle } from 'lucide-react';
import { Navbar } from '../components/Navbar';

export const MeetingEndedPage: React.FC = () => {
  const navigate = useNavigate();
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/30 text-brand-400 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-white">You Left the Meeting</h1>
            <p className="text-sm text-gray-400">
              Your audio, video, and screen sharing tracks have been safely terminated.
            </p>
          </div>

          {/* Quick Call Quality Feedback */}
          <div className="p-4 rounded-2xl bg-gray-950/60 border border-gray-800 space-y-2">
            <p className="text-xs font-semibold text-gray-300">How was the call quality?</p>
            {feedbackSubmitted ? (
              <p className="text-xs text-emerald-400">Thank you for your feedback!</p>
            ) : (
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => {
                      setRating(star);
                      setFeedbackSubmitted(true);
                    }}
                    className="p-1 text-gray-500 hover:text-amber-400 transition-colors"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        rating && rating >= star ? 'text-amber-400 fill-amber-400' : ''
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="space-y-3">
            <Link
              to="/dashboard"
              className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-brand-500/25"
            >
              <Home className="w-4 h-4" /> Go to Dashboard
            </Link>

            <Link
              to="/"
              className="w-full py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
