import React, { useState, useEffect, useCallback } from 'react';
import {
  initAuth,
  googleSignIn,
  requestDriveAuthorization,
  logout,
  getAccessToken,
  setCachedAccessToken,
} from './services/firebase';
import {
  extractDriveLinks,
  fetchDriveMetadata,
  fetchFolderContents,
  downloadFileBlob,
  getPublicDownloadUrl,
  getExportDetailsForMime,
} from './services/drive';
import {
  isFileSystemAccessSupported,
  pickLocalDirectory,
  saveBlobToDirectory,
  triggerBrowserDownload,
  triggerDirectUrlDownload,
  createAndDownloadZip,
} from './services/fileSystem';
import { Header } from './components/Header';
import { DirectorySelector } from './components/DirectorySelector';
import { LinkInput } from './components/LinkInput';
import { DownloadQueue } from './components/DownloadQueue';
import { ActivityLog } from './components/ActivityLog';
import { VerificationGuideModal } from './components/VerificationGuideModal';
import {
  DriveItem,
  DirectoryConfig,
  ActivityMessage,
  GoogleUserProfile,
} from './types';
import {
  FolderCheck,
  Download,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ShieldAlert,
  Layers,
  HardDrive,
  Activity,
  Sliders,
  FolderOpen,
  Info,
} from 'lucide-react';

export default function App() {
  // Auth state
  const [user, setUser] = useState<GoogleUserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [hasCustomToken, setHasCustomToken] = useState(false);

  // Local directory config
  const [directoryConfig, setDirectoryConfig] = useState<DirectoryConfig>({
    handle: null,
    name: '',
    isSupported: isFileSystemAccessSupported(),
  });
  const [isSelectingDirectory, setIsSelectingDirectory] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  // Files & Queue state
  const [items, setItems] = useState<DriveItem[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // Logs
  const [logs, setLogs] = useState<ActivityMessage[]>([]);

  const addLog = useCallback((text: string, type: ActivityMessage['type'] = 'info') => {
    const newLog: ActivityMessage = {
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toLocaleTimeString(),
      type,
      text,
    };
    setLogs((prev) => [...prev, newLog]);
  }, []);

  // Initialize auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser({
          displayName: currentUser.displayName,
          email: currentUser.email,
          photoURL: currentUser.photoURL,
        });
        setAccessToken(token);
        addLog(`Connected as ${currentUser.email || currentUser.displayName}`, 'success');
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, [addLog]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      addLog('Signing in with Google (Basic Profile)...', 'info');
      // Sign in with basic profile first (never blocked by Google verification)
      const result = await googleSignIn(false);
      if (result) {
        setUser({
          displayName: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoURL,
        });
        if (result.accessToken) {
          setAccessToken(result.accessToken);
        }
        addLog(`Signed in as ${result.user.email}`, 'success');

        // Now attempt to authorize Drive access
        try {
          addLog('Requesting Google Drive permission...', 'info');
          const driveToken = await requestDriveAuthorization();
          if (driveToken) {
            setAccessToken(driveToken);
            addLog('Drive access authorized! Private files can now be accessed.', 'success');
          }
        } catch (driveErr: any) {
          if (driveErr.message?.includes('Google verification') || driveErr.message?.includes('blocked')) {
            addLog(`Drive permission notice: ${driveErr.message}`, 'warning');
            setShowVerificationModal(true);
          } else {
            addLog(`Note: ${driveErr.message}`, 'info');
          }
        }
      }
    } catch (err: any) {
      if (err.message?.includes('Google verification') || err.message?.includes('blocked')) {
        addLog(`Access notice: ${err.message}`, 'warning');
        setShowVerificationModal(true);
      } else {
        addLog(`Sign in error: ${err.message}`, 'error');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAuthorizeDrive = async () => {
    try {
      addLog('Requesting Google Drive authorization...', 'info');
      const token = await requestDriveAuthorization();
      if (token) {
        setAccessToken(token);
        addLog('Google Drive authorization granted successfully!', 'success');
      }
    } catch (err: any) {
      addLog(err.message, 'warning');
      setShowVerificationModal(true);
    }
  };

  const handleSetCustomToken = (token: string) => {
    setAccessToken(token);
    setCachedAccessToken(token);
    setHasCustomToken(true);
    addLog('Custom OAuth Bearer token applied successfully.', 'success');
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setHasCustomToken(false);
    addLog('Signed out of Google Drive account.', 'info');
  };

  // Directory handling
  const handleSelectDirectory = async () => {
    setIsSelectingDirectory(true);
    setDirectoryError(null);
    try {
      const { handle, name } = await pickLocalDirectory();
      setDirectoryConfig({
        handle,
        name,
        isSupported: true,
      });
      addLog(`Selected local directory: "${name}"`, 'success');
    } catch (err: any) {
      if (err.message?.includes('cancelled')) {
        addLog('Directory selection cancelled.', 'info');
      } else {
        setDirectoryError(err.message);
        addLog(`Directory selection error: ${err.message}`, 'warning');
      }
    } finally {
      setIsSelectingDirectory(false);
    }
  };

  const handleClearDirectory = () => {
    setDirectoryConfig({
      handle: null,
      name: '',
      isSupported: isFileSystemAccessSupported(),
    });
    addLog('Reset destination to standard Downloads folder.', 'info');
  };

  // Add and resolve links
  const handleAddLinks = async (linksText: string) => {
    const parsed = extractDriveLinks(linksText);
    if (parsed.length === 0) {
      addLog('No valid Google Drive links were found in the input.', 'warning');
      return;
    }

    setIsLoadingLinks(true);
    addLog(`Resolving metadata for ${parsed.length} link(s)...`, 'info');

    const token = accessToken || (await getAccessToken());

    const newItems: DriveItem[] = [];

    for (const p of parsed) {
      // Check if already in queue
      if (items.some((i) => i.id === p.id)) {
        continue;
      }

      // Placeholder item while fetching
      const placeholder: DriveItem = {
        id: p.id,
        originalInput: p.raw,
        name: p.isFolder ? `Folder (${p.id})` : `File (${p.id})`,
        mimeType: p.isFolder ? 'application/vnd.google-apps.folder' : 'unknown',
        isFolder: p.isFolder,
        status: 'fetching_meta',
        progress: 0,
        selected: true,
      };

      try {
        const metadata = await fetchDriveMetadata(p.id, token, p.typeHint);
        newItems.push({
          ...placeholder,
          ...metadata,
          status: 'ready',
        } as DriveItem);
        addLog(`Loaded: ${metadata.name || p.id}`, 'info');
      } catch (err: any) {
        newItems.push({
          ...placeholder,
          status: 'error',
          errorMessage: err.message || 'Could not fetch metadata',
        });
        addLog(`Could not resolve ${p.id}: ${err.message}`, 'error');
      }
    }

    setItems((prev) => [...prev, ...newItems]);
    setIsLoadingLinks(false);
    addLog(`Finished loading items. ${newItems.length} added to queue.`, 'success');
  };

  // Expand folder contents
  const handleExpandFolder = async (folderItem: DriveItem) => {
    const token = accessToken || (await getAccessToken());
    if (!token) {
      addLog('Private folder listing requires Google sign in.', 'warning');
      handleLogin();
      return;
    }

    addLog(`Expanding folder "${folderItem.name}"...`, 'info');
    try {
      const childFiles = await fetchFolderContents(folderItem.id, token);
      if (childFiles.length === 0) {
        addLog(`Folder "${folderItem.name}" is empty or has no accessible files.`, 'warning');
        return;
      }

      // Remove the folder itself and add child files
      setItems((prev) => [
        ...prev.filter((i) => i.id !== folderItem.id),
        ...childFiles.filter((child) => !prev.some((existing) => existing.id === child.id)),
      ]);

      addLog(`Retrieved ${childFiles.length} file(s) from "${folderItem.name}"`, 'success');
    } catch (err: any) {
      addLog(`Failed to expand folder: ${err.message}`, 'error');
    }
  };

  // Change Google Doc export format
  const handleChangeDocExportFormat = (id: string, newExtension: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const baseName = item.name.replace(/\.(docx|xlsx|pptx|pdf|png)$/i, '');
        let newExportMime = item.exportMimeType;
        if (newExtension === '.pdf') {
          newExportMime = 'application/pdf';
        } else if (newExtension === '.docx') {
          newExportMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (newExtension === '.xlsx') {
          newExportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (newExtension === '.pptx') {
          newExportMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        }

        return {
          ...item,
          name: `${baseName}${newExtension}`,
          exportExtension: newExtension,
          exportMimeType: newExportMime,
        };
      })
    );
  };

  // Single file download
  const handleDownloadItem = async (item: DriveItem) => {
    const token = accessToken || (await getAccessToken());

    // Update item status
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: 'downloading', progress: 0, errorMessage: undefined } : i))
    );
    addLog(`Starting download: "${item.name}"...`, 'info');

    try {
      let blob: Blob | null = null;
      try {
        blob = await downloadFileBlob(item, token, (percent) => {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, progress: percent } : i))
          );
        });
      } catch (fetchErr: any) {
        // If in-memory fetch failed due to CORS or auth, trigger native browser direct URL download!
        if (!token) {
          const directUrl = getPublicDownloadUrl(item);
          addLog(`Triggering direct browser download from Google servers...`, 'info');
          triggerDirectUrlDownload(directUrl, item.name);
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i))
          );
          addLog(`✅ Download initiated for "${item.name}"`, 'success');
          return;
        }
        throw fetchErr;
      }

      if (!blob) {
        throw new Error('Could not retrieve file content.');
      }

      // Write to local directory if configured
      if (directoryConfig.handle) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'saving' } : i))
        );
        addLog(`Saving "${item.name}" to local folder "${directoryConfig.name}"...`, 'info');

        const saveResult = await saveBlobToDirectory(
          directoryConfig.handle,
          item.name,
          blob
        );

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: 'completed', savedPath: saveResult.savedPath, progress: 100 }
              : i
          )
        );
        addLog(`✅ Saved "${item.name}" to ${saveResult.savedPath}`, 'success');
      } else {
        // Fallback browser download
        triggerBrowserDownload(blob, item.name);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i
          )
        );
        addLog(`✅ Saved "${item.name}"`, 'success');
      }
    } catch (err: any) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'error', errorMessage: err.message || 'Download failed' }
            : i
        )
      );
      addLog(`❌ Failed to download "${item.name}": ${err.message}`, 'error');
    }
  };

  // Download all selected
  const handleDownloadAll = async () => {
    const selectedItems = items.filter((i) => i.selected && !i.isFolder);
    if (selectedItems.length === 0) {
      addLog('No files selected for download.', 'warning');
      return;
    }

    const token = accessToken || (await getAccessToken());

    // If local directory not set, prompt user if they want to choose one now
    let targetDirHandle = directoryConfig.handle;
    if (!targetDirHandle && isFileSystemAccessSupported()) {
      const wantDirectory = window.confirm(
        'Would you like to select a local folder on your computer to save all files automatically?'
      );
      if (wantDirectory) {
        try {
          const picked = await pickLocalDirectory();
          targetDirHandle = picked.handle;
          setDirectoryConfig({
            handle: picked.handle,
            name: picked.name,
            isSupported: true,
          });
          addLog(`Selected target directory: "${picked.name}"`, 'success');
        } catch {
          addLog('Proceeding with standard browser downloads.', 'info');
        }
      }
    }

    setIsDownloadingAll(true);
    addLog(`Starting batch download of ${selectedItems.length} file(s)...`, 'info');

    let successCount = 0;
    let failCount = 0;

    for (const item of selectedItems) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'downloading', progress: 0 } : i))
      );

      try {
        let blob: Blob | null = null;
        try {
          blob = await downloadFileBlob(item, token, (percent) => {
            setItems((prev) =>
              prev.map((i) => (i.id === item.id ? { ...i, progress: percent } : i))
            );
          });
        } catch (fetchErr: any) {
          if (!token) {
            const directUrl = getPublicDownloadUrl(item);
            triggerDirectUrlDownload(directUrl, item.name);
            setItems((prev) =>
              prev.map((i) => (i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i))
            );
            successCount++;
            continue;
          }
          throw fetchErr;
        }

        if (targetDirHandle && blob) {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: 'saving' } : i))
          );
          const res = await saveBlobToDirectory(targetDirHandle, item.name, blob);
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: 'completed', savedPath: res.savedPath, progress: 100 }
                : i
            )
          );
          addLog(`Saved "${item.name}" to ${res.savedPath}`, 'success');
        } else if (blob) {
          triggerBrowserDownload(blob, item.name);
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i
            )
          );
          addLog(`Downloaded "${item.name}"`, 'success');
        }

        successCount++;
      } catch (err: any) {
        failCount++;
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: 'error', errorMessage: err.message || 'Download failed' }
              : i
          )
        );
        addLog(`Error downloading "${item.name}": ${err.message}`, 'error');
      }
    }

    setIsDownloadingAll(false);
    addLog(
      `Batch download completed: ${successCount} successful, ${failCount} failed.`,
      failCount > 0 ? 'warning' : 'success'
    );
  };

  // Download as ZIP archive
  const handleDownloadZip = async () => {
    const selectedItems = items.filter((i) => i.selected && !i.isFolder);
    if (selectedItems.length === 0) {
      addLog('No files selected to package into ZIP.', 'warning');
      return;
    }

    const token = accessToken || (await getAccessToken());

    setIsDownloadingAll(true);
    addLog(`Fetching ${selectedItems.length} files to build ZIP archive...`, 'info');

    const filesToZip: { name: string; blob: Blob }[] = [];

    for (let index = 0; index < selectedItems.length; index++) {
      const item = selectedItems[index];
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'downloading', progress: 0 } : i))
      );

      try {
        const blob = await downloadFileBlob(item, token, (percent) => {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, progress: percent } : i))
          );
        });

        filesToZip.push({ name: item.name, blob });
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i))
        );
      } catch (err: any) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: 'error', errorMessage: err.message || 'Download failed' }
              : i
          )
        );
        addLog(`Could not add "${item.name}" to ZIP: ${err.message}`, 'error');
      }
    }

    if (filesToZip.length > 0) {
      addLog(`Packaging ${filesToZip.length} files into ZIP archive...`, 'info');
      try {
        const zipResult = await createAndDownloadZip(
          filesToZip,
          'google_drive_downloads.zip',
          directoryConfig.handle,
          (pct) => {
            addLog(`Compressing archive: ${pct}%`, 'info');
          }
        );
        if (zipResult.savedPath) {
          addLog(`✅ Saved ZIP archive directly to local folder: "${zipResult.savedPath}"!`, 'success');
        } else {
          addLog(`✅ ZIP archive created with ${filesToZip.length} files and downloaded!`, 'success');
        }
      } catch (zipErr: any) {
        addLog(`❌ Failed to write ZIP archive: ${zipErr.message}`, 'error');
      }
    } else {
      addLog('No files could be downloaded to include in the ZIP.', 'warning');
    }

    setIsDownloadingAll(false);
  };

  // Queue manipulation helpers
  const handleToggleSelect = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i))
    );
  };

  const handleToggleSelectAll = () => {
    const allSelected = items.every((i) => i.selected);
    setItems((prev) => prev.map((i) => ({ ...i, selected: !allSelected })));
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearAll = () => {
    setItems([]);
    addLog('Cleared all files from queue.', 'info');
  };

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const pendingCount = items.filter((i) => i.status !== 'completed' && i.status !== 'error').length;
  const errorCount = items.filter((i) => i.status === 'error').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
      <Header
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoggingIn={isLoggingIn}
        selectedDirectoryName={directoryConfig.name || null}
        onOpenVerificationGuide={() => setShowVerificationModal(true)}
        hasCustomToken={hasCustomToken}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Professional Polish Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 p-4 hidden md:flex flex-col gap-6 shrink-0 select-none">
          {/* Section: Download Configuration */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Download Configuration
            </p>
            <nav className="flex flex-col gap-1 text-sm">
              <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Batch Queue
                </span>
                <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-bold">
                  {items.length}
                </span>
              </div>
              <button
                onClick={handleSelectDirectory}
                className="w-full text-left px-3 py-2 text-slate-600 hover:bg-slate-50 rounded flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-slate-400" />
                Output Paths
              </button>
              <button
                onClick={() => setShowVerificationModal(true)}
                className="w-full text-left px-3 py-2 text-slate-600 hover:bg-slate-50 rounded flex items-center gap-2 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-amber-500" />
                <span>Verification Help</span>
              </button>
              <div className="px-3 py-2 text-slate-600 hover:bg-slate-50 rounded flex items-center justify-between transition-colors">
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-400" />
                  Events & Logs
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {logs.length}
                </span>
              </div>
            </nav>
          </div>

          {/* Section: Local Storage */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Local Storage
            </p>
            <div className="p-3.5 bg-slate-50 rounded border border-slate-200 text-xs">
              <div className="flex justify-between font-medium text-slate-700 mb-1.5">
                <span className="truncate max-w-[130px]" title={directoryConfig.name || 'Default Downloads'}>
                  {directoryConfig.name ? `📁 ${directoryConfig.name}` : 'Local Disk'}
                </span>
                <span className="text-blue-600 font-semibold">
                  {directoryConfig.handle ? 'Direct Save' : 'Standard'}
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{
                    width: items.length > 0
                      ? `${Math.round((completedCount / items.length) * 100)}%`
                      : '0%',
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                <span>{completedCount}/{items.length} files saved</span>
                <button
                  onClick={handleSelectDirectory}
                  className="text-blue-600 hover:underline font-medium cursor-pointer"
                >
                  Configure
                </button>
              </div>
            </div>
          </div>

          {/* Section: Queue Metrics */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Queue Telemetry
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Tasks Pending</span>
                <span className="font-semibold text-slate-700">{pendingCount}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Completed</span>
                <span className="font-semibold text-green-600">{completedCount}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Errors</span>
                <span className="font-semibold text-red-600">{errorCount}</span>
              </div>
            </div>
          </div>

          {/* Google Auth Status Card in Sidebar */}
          <div className="mt-auto pt-4 border-t border-slate-100 space-y-2">
            {user ? (
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="truncate">{user.email}</span>
                </div>
                {!accessToken && (
                  <button
                    onClick={handleAuthorizeDrive}
                    className="w-full text-center py-1 px-2 text-[11px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors cursor-pointer"
                  >
                    Authorize Private Drive
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="w-full py-2 px-3 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Connect Google Account</span>
              </button>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto">
          {/* Status guidance banner */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0 border border-blue-100">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="font-semibold text-slate-900 text-xs flex items-center gap-2">
                  <span>Public & Direct Mode Active</span>
                  <span className="bg-green-100 text-green-700 text-[10px] font-semibold px-1.5 py-0.2 rounded">
                    No Sign-In Required
                  </span>
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Files shared as <em>"Anyone with the link"</em> download directly to your computer. For private Google Drive files, connect your account or add your email to Test Users.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowVerificationModal(true)}
                className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors cursor-pointer"
              >
                Verification Help
              </button>
              {!user ? (
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isLoggingIn ? 'Connecting...' : 'Sign in'}
                </button>
              ) : !accessToken ? (
                <button
                  onClick={handleAuthorizeDrive}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Authorize Drive
                </button>
              ) : null}
            </div>
          </div>

          {/* Local Directory Selector */}
          <DirectorySelector
            directoryConfig={directoryConfig}
            onSelectDirectory={handleSelectDirectory}
            onClearDirectory={handleClearDirectory}
            isSelecting={isSelectingDirectory}
            errorMessage={directoryError}
          />

          {/* URL Input Form */}
          <LinkInput onAddLinks={handleAddLinks} isLoading={isLoadingLinks} />

          {/* Active Queue Table */}
          <DownloadQueue
            items={items}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onRemoveItem={handleRemoveItem}
            onClearAll={handleClearAll}
            onDownloadItem={handleDownloadItem}
            onDownloadAll={handleDownloadAll}
            onDownloadZip={handleDownloadZip}
            onExpandFolder={handleExpandFolder}
            onChangeDocExportFormat={handleChangeDocExportFormat}
            isDownloadingAll={isDownloadingAll}
            selectedDirectoryName={directoryConfig.name || null}
            hasLocalDirectory={!!directoryConfig.handle}
          />

          {/* Activity Log */}
          <ActivityLog logs={logs} onClear={() => setLogs([])} />
        </section>
      </div>

      {/* Professional Polish Footer */}
      <footer className="h-10 bg-white border-t border-slate-200 flex items-center justify-between px-6 text-xs text-slate-500 sticky bottom-0 z-20">
        <div className="flex items-center gap-3">
          <span className="truncate max-w-sm">
            Target: <span className="font-mono text-slate-700">{directoryConfig.name ? `Local folder (${directoryConfig.name})` : 'Default browser downloads'}</span>
          </span>
          <button
            onClick={handleSelectDirectory}
            className="text-blue-600 hover:underline font-medium cursor-pointer"
          >
            Change Path
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span>Version 1.0</span>
          <span>•</span>
          <span className="hidden sm:inline text-slate-400">
            Direct Local Storage (File System Access API)
          </span>
        </div>
      </footer>

      {/* Verification & Access Modal */}
      <VerificationGuideModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        userEmail={user?.email || 'chsafuwanch@gmail.com'}
        onSetCustomToken={handleSetCustomToken}
        hasCustomToken={hasCustomToken}
      />
    </div>
  );
}
