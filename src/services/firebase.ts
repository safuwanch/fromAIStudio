import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Standard provider for profile/email (never blocked by Google verification)
const getBasicProvider = () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
};

// Provider requesting Drive scope
const getDriveProvider = () => {
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_READONLY_SCOPE);
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Standard Google Sign-In (profile + email)
 * This does NOT request restricted scopes, so Google will NOT block it!
 */
export const googleSignIn = async (
  requestDriveScope = false
): Promise<{ user: User; accessToken: string | null } | null> => {
  try {
    isSigningIn = true;
    const provider = requestDriveScope ? getDriveProvider() : getBasicProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    if (error?.code === 'auth/access-blocked' || error?.message?.includes('verification process') || error?.message?.includes('Access blocked')) {
      throw new Error(
        'Google OAuth Verification: This Google Cloud project is in development mode. To authorize private Drive access, your Google email must be added to "Test Users" in Google Cloud Console, or you can download public files without signing in.'
      );
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Request Drive read-only scope for an already signed-in user or new user
 */
export const requestDriveAuthorization = async (): Promise<string | null> => {
  try {
    isSigningIn = true;
    const provider = getDriveProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      return cachedAccessToken;
    }
    return null;
  } catch (error: any) {
    if (error?.code === 'auth/access-blocked' || error?.message?.includes('verification process') || error?.message?.includes('Access blocked')) {
      throw new Error(
        'Google OAuth Verification: This Google Cloud project is in development mode. To authorize private Drive access, your Google email must be added to "Test Users" in Google Cloud Console, or you can download public files without signing in.'
      );
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
