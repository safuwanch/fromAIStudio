import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, Trash2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { ActivityMessage } from '../types';

interface ActivityLogProps {
  logs: ActivityMessage[];
  onClear: () => void;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ logs, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (logs.length === 0) return null;

  const latestLog = logs[logs.length - 1];

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
      {/* Header bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700">
            Activity Log ({logs.length})
          </span>
          {!isOpen && latestLog && (
            <span className="text-[11px] text-slate-500 font-mono truncate max-w-sm ml-2">
              [{latestLog.timestamp}] {latestLog.text}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              title="Clear logs"
              className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </div>

      {/* Expanded view */}
      {isOpen && (
        <div className="p-3 max-h-56 overflow-y-auto font-mono text-xs divide-y divide-slate-800 bg-slate-900 text-slate-200">
          {logs.map((log) => (
            <div key={log.id} className="py-1.5 flex items-start gap-2">
              <span className="text-slate-500 text-[10px] shrink-0 select-none">
                [{log.timestamp}]
              </span>

              {log.type === 'success' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
              )}
              {log.type === 'error' && (
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              )}
              {log.type === 'info' && (
                <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              )}
              {log.type === 'warning' && (
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              )}

              <span
                className={`flex-1 break-all ${
                  log.type === 'success'
                    ? 'text-green-300'
                    : log.type === 'error'
                    ? 'text-red-300'
                    : log.type === 'warning'
                    ? 'text-amber-300'
                    : 'text-slate-300'
                }`}
              >
                {log.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

