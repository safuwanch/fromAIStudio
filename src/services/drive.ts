import { DriveItem } from '../types';

export interface ParsedLinkResult {
  raw: string;
  id: string;
  isFolder: boolean;
  typeHint?: 'doc' | 'sheet' | 'slide' | 'file' | 'folder';
}

/**
 * Extracts Google Drive / Docs file or folder IDs from various link formats
 */
export function parseDriveLink(input: string): ParsedLinkResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Folder patterns:
  // https://drive.google.com/drive/folders/1abc...
  // https://drive.google.com/drive/u/0/folders/1abc...
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/i);
  if (folderMatch) {
    return { raw: trimmed, id: folderMatch[1], isFolder: true, typeHint: 'folder' };
  }

  // Google Docs / Sheets / Slides patterns:
  // https://docs.google.com/document/d/1abc...
  const docMatch = trimmed.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i);
  if (docMatch) {
    return { raw: trimmed, id: docMatch[1], isFolder: false, typeHint: 'doc' };
  }

  const sheetMatch = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i);
  if (sheetMatch) {
    return { raw: trimmed, id: sheetMatch[1], isFolder: false, typeHint: 'sheet' };
  }

  const slideMatch = trimmed.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/i);
  if (slideMatch) {
    return { raw: trimmed, id: slideMatch[1], isFolder: false, typeHint: 'slide' };
  }

  // Standard Drive file links:
  // https://drive.google.com/file/d/1abc.../view
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileDMatch) {
    return { raw: trimmed, id: fileDMatch[1], isFolder: false, typeHint: 'file' };
  }

  // Open / uc params:
  // https://drive.google.com/open?id=1abc...
  // https://drive.google.com/uc?id=1abc...
  const paramMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (paramMatch) {
    return { raw: trimmed, id: paramMatch[1], isFolder: false, typeHint: 'file' };
  }

  // Check if it's already a bare ID (alphanumeric, at least 20 chars)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return { raw: trimmed, id: trimmed, isFolder: false };
  }

  return null;
}

/**
 * Parses raw text containing multiple lines or space/comma separated links
 */
export function extractDriveLinks(text: string): ParsedLinkResult[] {
  // Split on newlines, commas, or multiple whitespaces
  const tokens = text.split(/[\r\n,;\s]+/).filter(Boolean);
  const seenIds = new Set<string>();
  const results: ParsedLinkResult[] = [];

  for (const token of tokens) {
    const parsed = parseDriveLink(token);
    if (parsed && !seenIds.has(parsed.id)) {
      seenIds.add(parsed.id);
      results.push(parsed);
    }
  }

  return results;
}

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return 'Unknown size';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getExportDetailsForMime(mimeType: string, preferFormat: 'original' | 'pdf' | 'office' = 'office'): {
  isGoogleDoc: boolean;
  exportMimeType?: string;
  defaultExtension?: string;
} {
  if (mimeType === 'application/vnd.google-apps.document') {
    if (preferFormat === 'pdf') {
      return { isGoogleDoc: true, exportMimeType: 'application/pdf', defaultExtension: '.pdf' };
    }
    return {
      isGoogleDoc: true,
      exportMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      defaultExtension: '.docx',
    };
  }

  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    if (preferFormat === 'pdf') {
      return { isGoogleDoc: true, exportMimeType: 'application/pdf', defaultExtension: '.pdf' };
    }
    return {
      isGoogleDoc: true,
      exportMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      defaultExtension: '.xlsx',
    };
  }

  if (mimeType === 'application/vnd.google-apps.presentation') {
    if (preferFormat === 'pdf') {
      return { isGoogleDoc: true, exportMimeType: 'application/pdf', defaultExtension: '.pdf' };
    }
    return {
      isGoogleDoc: true,
      exportMimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      defaultExtension: '.pptx',
    };
  }

  if (mimeType === 'application/vnd.google-apps.drawing') {
    return { isGoogleDoc: true, exportMimeType: 'image/png', defaultExtension: '.png' };
  }

  return { isGoogleDoc: false };
}

/**
 * Returns direct public download or export URL for a Google Drive / Docs item
 */
export function getPublicDownloadUrl(item: DriveItem): string {
  const mime = item.mimeType?.toLowerCase() || '';
  const ext = (item.exportExtension || '').replace('.', '').toLowerCase();

  if (item.isGoogleDoc || mime.includes('google-apps.document')) {
    const fmt = ext === 'pdf' ? 'pdf' : 'docx';
    return `https://docs.google.com/document/d/${item.id}/export?format=${fmt}`;
  }

  if (mime.includes('google-apps.spreadsheet')) {
    const fmt = ext === 'pdf' ? 'pdf' : ext === 'csv' ? 'csv' : 'xlsx';
    return `https://docs.google.com/spreadsheets/d/${item.id}/export?format=${fmt}`;
  }

  if (mime.includes('google-apps.presentation')) {
    const fmt = ext === 'pdf' ? 'pdf' : 'pptx';
    return `https://docs.google.com/presentation/d/${item.id}/export?format=${fmt}`;
  }

  // Standard binary file direct download URL
  return `https://drive.usercontent.google.com/download?id=${item.id}&export=download`;
}

/**
 * Fetches file metadata from server proxy or Google Drive API v3,
 * or gracefully infers item attributes for public links without auth.
 */
export async function fetchDriveMetadata(
  fileId: string,
  accessToken?: string | null,
  typeHint?: 'doc' | 'sheet' | 'slide' | 'file' | 'folder'
): Promise<Partial<DriveItem>> {
  // 1. Try server proxy metadata (resolves authentic Google Drive names and public titles)
  try {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await fetch(`/api/proxy-metadata?id=${fileId}&type=${typeHint || 'file'}`, { headers });
    if (res.ok) {
      const data = await res.json();
      const isFolder = data.mimeType === 'application/vnd.google-apps.folder';
      const exportInfo = getExportDetailsForMime(data.mimeType);

      let finalName = data.name || `drive_file_${fileId}`;
      if (exportInfo.isGoogleDoc && exportInfo.defaultExtension && !finalName.endsWith(exportInfo.defaultExtension)) {
        finalName += exportInfo.defaultExtension;
      }

      return {
        id: data.id || fileId,
        name: finalName,
        mimeType: data.mimeType || 'application/octet-stream',
        size: data.size ? parseInt(data.size, 10) : undefined,
        sizeFormatted: data.size ? formatFileSize(parseInt(data.size, 10)) : 'Ready',
        iconUrl: data.iconLink,
        thumbnailLink: data.thumbnailLink,
        isFolder,
        isGoogleDoc: exportInfo.isGoogleDoc,
        exportMimeType: exportInfo.exportMimeType,
        exportExtension: exportInfo.defaultExtension,
        status: 'ready',
        progress: 0,
        selected: true,
      };
    }
  } catch {
    // Fall through to client inference
  }

  // Public fallback mode (no token or token unauthenticated)
  // Smartly infer file type and export configuration from typeHint
  let inferredMime = 'application/octet-stream';
  let inferredName = `Drive_File_${fileId.substring(0, 8)}`;
  let isGoogleDoc = false;
  let exportMimeType: string | undefined;
  let defaultExtension: string | undefined;
  const isFolder = typeHint === 'folder';

  if (typeHint === 'doc') {
    inferredMime = 'application/vnd.google-apps.document';
    inferredName = `Document_${fileId.substring(0, 8)}.docx`;
    isGoogleDoc = true;
    exportMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    defaultExtension = '.docx';
  } else if (typeHint === 'sheet') {
    inferredMime = 'application/vnd.google-apps.spreadsheet';
    inferredName = `Spreadsheet_${fileId.substring(0, 8)}.xlsx`;
    isGoogleDoc = true;
    exportMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    defaultExtension = '.xlsx';
  } else if (typeHint === 'slide') {
    inferredMime = 'application/vnd.google-apps.presentation';
    inferredName = `Presentation_${fileId.substring(0, 8)}.pptx`;
    isGoogleDoc = true;
    exportMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    defaultExtension = '.pptx';
  } else if (typeHint === 'folder') {
    inferredMime = 'application/vnd.google-apps.folder';
    inferredName = `Folder_${fileId.substring(0, 8)}`;
  }

  return {
    id: fileId,
    name: inferredName,
    mimeType: inferredMime,
    size: undefined,
    sizeFormatted: 'Public link',
    isFolder,
    isGoogleDoc,
    exportMimeType,
    exportExtension: defaultExtension,
    status: 'ready',
    progress: 0,
    selected: true,
  };
}

/**
 * If the link is a folder, fetches the files inside this folder
 */
export async function fetchFolderContents(
  folderId: string,
  accessToken?: string | null
): Promise<DriveItem[]> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,iconLink,thumbnailLink)&pageSize=100`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list folder contents: ${err}`);
  }

  const data = await res.json();
  const files: any[] = data.files || [];

  return files.map((f) => {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    const exportInfo = getExportDetailsForMime(f.mimeType);
    let name = f.name || `file_${f.id}`;
    if (exportInfo.isGoogleDoc && exportInfo.defaultExtension && !name.endsWith(exportInfo.defaultExtension)) {
      name += exportInfo.defaultExtension;
    }

    return {
      id: f.id,
      originalInput: `Folder child: ${f.name}`,
      name,
      mimeType: f.mimeType,
      size: f.size ? parseInt(f.size, 10) : undefined,
      sizeFormatted: formatFileSize(f.size ? parseInt(f.size, 10) : undefined),
      iconUrl: f.iconLink,
      thumbnailLink: f.thumbnailLink,
      isFolder,
      isGoogleDoc: exportInfo.isGoogleDoc,
      exportMimeType: exportInfo.exportMimeType,
      exportExtension: exportInfo.defaultExtension,
      status: 'ready',
      progress: 0,
      selected: true,
    };
  });
}

/**
 * Downloads the binary Blob of the file using the server proxy (eliminating CORS)
 * or direct Google Drive API / public URLs.
 */
export async function downloadFileBlob(
  item: DriveItem,
  accessToken?: string | null,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const mime = item.mimeType?.toLowerCase() || '';
  let typeHint = 'file';
  if (item.isGoogleDoc || mime.includes('google-apps.document')) typeHint = 'doc';
  else if (mime.includes('google-apps.spreadsheet')) typeHint = 'sheet';
  else if (mime.includes('google-apps.presentation')) typeHint = 'slide';

  const queryParams = new URLSearchParams({
    id: item.id,
    type: typeHint,
    format: (item.exportExtension || '').replace('.', '').toLowerCase(),
    exportMimeType: item.exportMimeType || '',
    name: item.name,
  });

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response: Response | null = null;
  let lastError: Error | null = null;

  // 1. Primary: Route through server download proxy to eliminate browser CORS
  try {
    const proxyUrl = `/api/proxy-download?${queryParams.toString()}`;
    response = await fetch(proxyUrl, { headers });
  } catch (err: any) {
    lastError = err;
  }

  // 2. Fallback: If proxy is not reachable, try direct client fetch
  if (!response || (!response.ok && response.status === 404)) {
    try {
      let downloadUrl = '';
      if (accessToken) {
        if (item.isGoogleDoc && item.exportMimeType) {
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${item.id}/export?mimeType=${encodeURIComponent(
            item.exportMimeType
          )}`;
        } else {
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${item.id}?alt=media`;
        }
      } else {
        downloadUrl = getPublicDownloadUrl(item);
      }
      response = await fetch(downloadUrl, { headers });
    } catch (fallbackErr: any) {
      throw new Error(
        lastError?.message ||
          fallbackErr.message ||
          'Failed to retrieve file. If file is private, please authorize Google Drive.'
      );
    }
  }

  if (!response.ok) {
    let msg = `Download failed (${response.status} ${response.statusText})`;
    try {
      const errJson = await response.json();
      if (errJson.error) {
        msg = typeof errJson.error === 'string' ? errJson.error : errJson.error.message || msg;
      }
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : item.size || 0;

  // Stream with progress if body is a readable stream
  if (response.body && total > 0 && onProgress) {
    const reader = response.body.getReader();
    let receivedLength = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        receivedLength += value.length;
        const pct = Math.min(100, Math.round((receivedLength / total) * 100));
        onProgress(pct);
      }
    }

    onProgress(100);
    return new Blob(chunks, {
      type: item.exportMimeType || item.mimeType || 'application/octet-stream',
    });
  }

  // Direct blob read
  const blob = await response.blob();
  if (onProgress) onProgress(100);
  return blob;
}
