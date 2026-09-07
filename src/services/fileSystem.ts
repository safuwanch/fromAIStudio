import JSZip from 'jszip';

export interface SavedFileResult {
  success: boolean;
  fileName: string;
  savedPath: string;
  size: number;
}

/**
 * Verify write permissions on a DirectoryHandle, requesting it if needed
 */
export async function verifyDirectoryPermission(
  dirHandle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  if (!(dirHandle as any).queryPermission) return true;
  try {
    const opts = { mode };
    const current = await (dirHandle as any).queryPermission(opts);
    if (current === 'granted') return true;
    const requested = await (dirHandle as any).requestPermission(opts);
    return requested === 'granted';
  } catch {
    return false;
  }
}

/**
 * Check if the browser supports the File System Access API
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Check if the app is currently running within an iframe
 */
export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Ask the user to select a local directory on their system
 */
export async function pickLocalDirectory(): Promise<{
  handle: FileSystemDirectoryHandle;
  name: string;
}> {
  if (!isFileSystemAccessSupported()) {
    throw new Error(
      'The File System Access API is not supported in this browser. Please use Chrome, Edge, or a Chromium-based desktop browser.'
    );
  }

  const inIframe = isRunningInIframe();

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'downloads',
    });
    return { handle, name: handle.name || 'Selected Directory' };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Directory selection was cancelled.');
    }
    if (err.name === 'SecurityError' || inIframe) {
      throw new Error(
        'Browsers restrict folder picking inside embedded preview frames. Please click "Open in New Tab" at the top-right header to select your local folder!'
      );
    }
    throw err;
  }
}

/**
 * Clean illegal characters for local filesystems
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'unnamed_file';
}

/**
 * Writes a binary Blob directly into a selected local directory handle
 */
export async function saveBlobToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob
): Promise<SavedFileResult> {
  const safeName = sanitizeFilename(filename);

  // Check write permissions
  const hasPerm = await verifyDirectoryPermission(dirHandle, 'readwrite');
  if (!hasPerm) {
    throw new Error(
      `Permission to write to folder "${dirHandle.name}" was not granted. Please re-select the directory.`
    );
  }

  // Get or create file handle in the chosen local directory
  const fileHandle = await dirHandle.getFileHandle(safeName, { create: true });
  const writable = await (fileHandle as any).createWritable();
  await writable.write(blob);
  await writable.close();

  return {
    success: true,
    fileName: safeName,
    savedPath: `${dirHandle.name}/${safeName}`,
    size: blob.size,
  };
}

/**
 * Fallback: trigger standard browser download to default downloads folder
 */
export function triggerBrowserDownload(blob: Blob, filename: string) {
  const safeName = sanitizeFilename(filename);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Creates and downloads a single .zip archive containing all downloaded files.
 * If dirHandle is provided, writes the ZIP directly into the selected output path!
 */
export async function createAndDownloadZip(
  files: { name: string; blob: Blob }[],
  zipFilename: string = 'drive_downloads.zip',
  dirHandle?: FileSystemDirectoryHandle | null,
  onProgress?: (percent: number) => void
): Promise<{ savedPath?: string; size: number }> {
  if (files.length === 0) {
    throw new Error('No files provided to create ZIP archive.');
  }

  const zip = new JSZip();

  // Deduplicate file names in zip if multiple files have the exact same name
  const nameCounts: Record<string, number> = {};

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let name = sanitizeFilename(file.name);
    if (nameCounts[name]) {
      const parts = name.split('.');
      if (parts.length > 1) {
        const ext = parts.pop();
        name = `${parts.join('.')}_(${nameCounts[file.name]}).${ext}`;
      } else {
        name = `${name}_(${nameCounts[file.name]})`;
      }
      nameCounts[file.name]++;
    } else {
      nameCounts[file.name] = 1;
    }

    zip.file(name, file.blob);
  }

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onProgress) {
        onProgress(Math.round(metadata.percent));
      }
    }
  );

  let savedPath: string | undefined;

  // Save directly to selected directory if present
  if (dirHandle) {
    const res = await saveBlobToDirectory(dirHandle, zipFilename, zipBlob);
    savedPath = res.savedPath;
  } else {
    triggerBrowserDownload(zipBlob, zipFilename);
  }

  return { savedPath, size: zipBlob.size };
}

/**
 * Direct URL download fallback when CORS prevents in-memory fetch
 */
export function triggerDirectUrlDownload(url: string, filename: string) {
  const safeName = sanitizeFilename(filename);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
  }, 1000);
}
