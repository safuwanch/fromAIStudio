import React from 'react';
import { Folder, FolderCheck, FolderPlus, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { DirectoryConfig } from '../types';
import { isRunningInIframe } from '../services/fileSystem';

interface DirectorySelectorProps {
  directoryConfig: DirectoryConfig;
  onSelectDirectory: () => void;
  onClearDirectory: () => void;
  isSelecting: boolean;
  errorMessage?: string | null;
}

export const DirectorySelector: React.FC<DirectorySelectorProps> = ({
  directoryConfig,
  onSelectDirectory,
  onClearDirectory,
  isSelecting,
  errorMessage,
}) => {
  const hasSelectedDir = !!directoryConfig.handle;
  const inIframe = isRunningInIframe();

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Destination Information */}
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              hasSelectedDir
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {hasSelectedDir ? (
              <FolderCheck className="w-5 h-5" />
            ) : (
              <Folder className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Output Path:
              </span>
              {hasSelectedDir ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Custom Local Folder
                </span>
              ) : (
                <span className="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Default Downloads
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 mt-1">
              {hasSelectedDir ? (
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-900 font-semibold bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 font-mono">
                    📁 {directoryConfig.name}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Files &amp; .ZIP packages will save directly into this directory
                  </span>
                </span>
              ) : (
                <span className="text-slate-500 font-sans">
                  Choose a local directory on your computer to auto-save files directly without browser prompts.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            onClick={onSelectDirectory}
            disabled={isSelecting}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>{isSelecting ? 'Selecting...' : hasSelectedDir ? 'Change Folder' : 'Select Local Folder'}</span>
          </button>

          {hasSelectedDir && (
            <button
              onClick={onClearDirectory}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-md hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}

          {inIframe && !hasSelectedDir && (
            <button
              onClick={handleOpenNewTab}
              title="Open in new window for direct disk access"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Open in New Tab</span>
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mt-3 flex items-start justify-between gap-3 text-xs bg-amber-50 text-amber-900 p-3 rounded-md border border-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-900 leading-relaxed">{errorMessage}</p>
          </div>
          {errorMessage.includes('New Tab') && (
            <button
              onClick={handleOpenNewTab}
              className="inline-flex items-center gap-1 shrink-0 px-2.5 py-1 text-[11px] font-medium bg-amber-200 hover:bg-amber-300 text-amber-950 rounded transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open Now</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};


