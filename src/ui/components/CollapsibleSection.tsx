import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  badge?: string | number;
  icon?: React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  badge,
  icon,
  defaultExpanded = true,
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-sand-400/15 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-semibold text-sand-200 hover:text-white hover:bg-moss-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-sand-400">{icon}</span>}
          <span className="tracking-wide uppercase text-[11px] text-sand-300 font-gorton">{title}</span>
          {badge !== undefined && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-moss-700/60 text-sand-200 border border-sand-400/20">
              {badge}
            </span>
          )}
        </div>
        <span className="text-sand-400">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </button>
      {isExpanded && <div className="px-3.5 pb-3.5 pt-1 space-y-3">{children}</div>}
    </div>
  );
};
