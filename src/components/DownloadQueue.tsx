import React from 'react';
import {
  File,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Video,
  Archive,
  Folder,
  Download,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  FolderOpen,
  FileArchive,
  FolderCheck,
} from 'lucide-react';
import { DriveItem } from '../types';

interface DownloadQueueProps {
  items: DriveItem[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onDownloadItem: (item: DriveItem) => Promise<void>;
  onDownloadAll: () => Promise<void>;
  onDownloadZip: () => Promise<void>;
  onExpandFolder: (folderItem: DriveItem) => Promise<void>;
  onChangeDocExportFormat: (id: string, format: string) => void;
  isDownloadingAll: boolean;
  selectedDirectoryName: string | null;
  hasLocalDirectory: boolean;
}

export const DownloadQueue: React.FC<DownloadQueueProps> = ({
  items,
  onToggleSelect,
  onToggleSelectAll,
  onRemoveItem,
  onClearAll,
  onDownloadItem,
  onDownloadAll,
  onDownloadZip,
  onExpandFolder,
  onChangeDocExportFormat,
  isDownloadingAll,
  selectedDirectoryName,
  hasLocalDirectory,
}) => {
  if (items.length === 0) {
    return null;
  }

  const selectedCount = items.filter((i) => i.selected).length;
  const allSelected = items.length > 0 && selectedCount === items.length;
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const pendingCount = items.filter((i) => i.status !== 'completed' && i.status !== 'error').length;
  const errorCount = items.filter((i) => i.status === 'error').length;

  const getFileIcon = (item: DriveItem) => {
    if (item.isFolder) return <Folder className="w-4 h-4 text-amber-500" />;
    const mime = item.mimeType?.toLowerCase() || '';

    if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
    }
    if (mime.includes('presentation') || mime.includes('powerpoint')) {
      return <Presentation className="w-4 h-4 text-amber-600" />;
    }
    if (mime.includes('document') || mime.includes('word') || mime.includes('text')) {
      return <FileText className="w-4 h-4 text-blue-600" />;
    }
    if (mime.includes('image')) {
      return <ImageIcon className="w-4 h-4 text-purple-600" />;
    }
    if (mime.includes('video')) {
      return <Video className="w-4 h-4 text-rose-600" />;
    }
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || mime.includes('compressed')) {
      return <Archive className="w-4 h-4 text-orange-600" />;
    }
    return <File className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="flex-1 flex flex-col border border-slate-200 bg-white rounded-lg shadow-xs overflow-hidden">
      {/* Table Header / Title bar */}
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap justify-between items-center bg-slate-50 rounded-t-lg gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-slate-700">Active Queue</h2>
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
            {pendingCount} Tasks Remaining
          </span>
          {completedCount > 0 && (
            <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
              {completedCount} Saved
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              {errorCount} Failed
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Main Action: Download Batch */}
          <button
            onClick={onDownloadAll}
            disabled={selectedCount === 0 || isDownloadingAll}
            className="px-3.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
          >
            {isDownloadingAll ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Downloading...</span>
              </>
            ) : hasLocalDirectory ? (
              <>
                <FolderCheck className="w-3.5 h-3.5" />
                <span>Save {selectedCount} to Folder</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download {selectedCount} Files</span>
              </>
            )}
          </button>

          {/* Secondary Action: Zip */}
          <button
            onClick={onDownloadZip}
            disabled={selectedCount === 0 || isDownloadingAll}
            className="px-3 py-1.5 bg-white text-slate-700 text-xs font-medium border border-slate-300 rounded hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <FileArchive className="w-3.5 h-3.5 text-slate-500" />
            <span>Package .ZIP</span>
          </button>

          {/* Clear Button */}
          <button
            onClick={onClearAll}
            disabled={isDownloadingAll}
            title="Clear list"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Queue Table */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase bg-slate-50/50 select-none">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3">Filename</th>
              <th className="px-4 py-3 w-28">Size</th>
              <th className="px-4 py-3 w-48">Progress</th>
              <th className="px-4 py-3 w-40">Status</th>
              <th className="px-4 py-3 w-20 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm text-slate-600 divide-y divide-slate-100">
            {items.map((item) => {
              const isBusy = item.status === 'downloading' || item.status === 'saving';

              return (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-50 transition-colors ${
                    item.selected ? 'bg-blue-50/30' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => onToggleSelect(item.id)}
                      disabled={isBusy}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>

                  {/* Filename & Format Selection */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                        {getFileIcon(item)}
                      </div>
                      <div className="min-w-0 max-w-sm">
                        <p className="font-medium text-slate-800 truncate text-xs" title={item.name}>
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span className="truncate max-w-[120px]">
                            {item.mimeType?.replace('application/vnd.google-apps.', 'Google ') || 'File'}
                          </span>

                          {/* Export format dropdown for Google Docs */}
                          {item.isGoogleDoc && (
                            <select
                              value={item.exportExtension}
                              onChange={(e) => onChangeDocExportFormat(item.id, e.target.value)}
                              className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[10px] rounded px-1.5 py-0.5 text-slate-700 cursor-pointer font-sans"
                            >
                              {item.mimeType.includes('document') && (
                                <>
                                  <option value=".docx">Export .docx</option>
                                  <option value=".pdf">Export .pdf</option>
                                </>
                              )}
                              {item.mimeType.includes('spreadsheet') && (
                                <>
                                  <option value=".xlsx">Export .xlsx</option>
                                  <option value=".pdf">Export .pdf</option>
                                </>
                              )}
                              {item.mimeType.includes('presentation') && (
                                <>
                                  <option value=".pptx">Export .pptx</option>
                                  <option value=".pdf">Export .pdf</option>
                                </>
                              )}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Size */}
                  <td className="px-4 py-3.5 text-xs text-slate-600 font-mono">
                    {item.sizeFormatted || '—'}
                  </td>

                  {/* Progress */}
                  <td className="px-4 py-3.5">
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className="bg-blue-600 h-full transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
                    {isBusy && (
                      <span className="text-[10px] font-mono text-blue-600 mt-1 block">
                        {item.status === 'saving' ? 'Writing to disk...' : `${item.progress}%`}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 text-xs">
                    {item.status === 'completed' && (
                      <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Saved
                      </span>
                    )}
                    {item.status === 'downloading' && (
                      <span className="text-blue-600 font-medium animate-pulse">
                        Downloading...
                      </span>
                    )}
                    {item.status === 'saving' && (
                      <span className="text-blue-600 font-medium">
                        Saving to disk...
                      </span>
                    )}
                    {item.status === 'ready' && (
                      <span className="text-slate-400">
                        Pending Queue
                      </span>
                    )}
                    {item.status === 'fetching_meta' && (
                      <span className="text-slate-400">
                        Awaiting Metadata
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span
                        className="inline-flex items-center gap-1 text-red-600 font-medium truncate max-w-[140px]"
                        title={item.errorMessage}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{item.errorMessage || 'Failed'}</span>
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.isFolder ? (
                        <button
                          onClick={() => onExpandFolder(item)}
                          disabled={isBusy}
                          title="Expand folder files"
                          className="p-1 text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onDownloadItem(item)}
                          disabled={isBusy}
                          title="Download individually"
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => onRemoveItem(item.id)}
                        disabled={isBusy}
                        title="Remove"
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
