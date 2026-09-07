export interface DriveItem {
  id: string;
  originalInput: string;
  name: string;
  mimeType: string;
  size?: number;
  sizeFormatted?: string;
  iconUrl?: string;
  thumbnailLink?: string;
  isFolder?: boolean;
  isGoogleDoc?: boolean;
  exportMimeType?: string;
  exportExtension?: string;
  status: 'idle' | 'fetching_meta' | 'ready' | 'downloading' | 'saving' | 'completed' | 'error';
  progress: number;
  errorMessage?: string;
  selected: boolean;
  savedPath?: string;
}

export interface DirectoryConfig {
  handle: FileSystemDirectoryHandle | null;
  name: string;
  isSupported: boolean;
}

export interface ActivityMessage {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

export interface GoogleUserProfile {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
