import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface CookieConsentBannerProps {
  onAccept: () => void;
  onDecline: () => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onAccept, onDecline }) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[calc(100%-2rem)] p-4 rounded-lg bg-moss-900/95 border border-sand-400/30 backdrop-blur-md shadow-2xl text-xs text-sand-100 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in print-hide">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <span>
          CutUp Chroma stores your workspace preferences locally in your browser. No external cookies or telemetry tracking are used.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onDecline}
          className="px-2.5 py-1 text-sand-400 hover:text-sand-200 text-[11px] transition-colors"
        >
          Session Only
        </button>
        <button
          onClick={onAccept}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded text-[11px] transition-colors"
        >
          Accept & Save
        </button>
      </div>
    </div>
  );
};
