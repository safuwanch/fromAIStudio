import React, { useState } from 'react';
import { ShieldAlert, ExternalLink, CheckCircle2, Copy, Check, Key, X, AlertTriangle, Sparkles } from 'lucide-react';

interface VerificationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
  onSetCustomToken: (token: string) => void;
  hasCustomToken: boolean;
}

export const VerificationGuideModal: React.FC<VerificationGuideModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  onSetCustomToken,
  hasCustomToken,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSuccess, setTokenSuccess] = useState(false);

  if (!isOpen) return null;

  const emailToUse = userEmail || 'chsafuwanch@gmail.com';
  const consoleUrl = 'https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0006172183';

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(emailToUse);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleApplyToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    onSetCustomToken(tokenInput.trim());
    setTokenSuccess(true);
    setTimeout(() => setTokenSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Resolving "Access Blocked: Google Verification"
              </h2>
              <p className="text-xs text-slate-500">
                Why Google displays this message and 3 simple ways to proceed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Root Cause Explanation */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-700 leading-relaxed space-y-1.5">
          <p className="font-semibold text-slate-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            Why does Google block access?
          </p>
          <p>
            Google Drive access (<code className="bg-slate-200/70 px-1 py-0.5 rounded font-mono text-[11px]">drive.readonly</code>) is a protected sensitive scope. When an app is in development mode, Google only permits accounts listed under <strong className="text-slate-900">"Test users"</strong> in the Google Cloud Console to log in with Drive permissions.
          </p>
        </div>

        {/* 3 Workarounds */}
        <div className="space-y-4">
          {/* Option 1 */}
          <div className="border border-green-200 bg-green-50/60 rounded-lg p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-900 font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-green-600" />
                <span>Option 1: Direct Download without Sign-In (Recommended)</span>
              </div>
              <span className="bg-green-200 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Instant
              </span>
            </div>
            <p className="text-green-800/90 leading-relaxed">
              If your Google Drive file or folder is set to <strong>"Anyone with the link can view"</strong>, you do <strong className="underline">not</strong> need to sign in or complete verification at all. Simply paste the link and click <strong>Download</strong>!
            </p>
          </div>

          {/* Option 2 */}
          <div className="border border-slate-200 bg-white rounded-lg p-4 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>Option 2: Add Email to "Test Users" in Google Cloud Console</span>
              </div>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                For Private Files
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              If you need to access private files inside your personal Drive:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-700 pl-1">
              <li>
                Open the{' '}
                <a
                  href={consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 font-medium hover:underline inline-flex items-center gap-1"
                >
                  Google Cloud OAuth Consent Screen <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Scroll down to the <strong className="text-slate-900">Test users</strong> section and click <strong className="text-slate-900">+ ADD USERS</strong>.
              </li>
              <li className="flex items-center gap-2 flex-wrap">
                <span>Enter your email address:</span>
                <span className="bg-slate-100 font-mono px-2 py-0.5 rounded text-slate-800 border border-slate-200">
                  {emailToUse}
                </span>
                <button
                  onClick={handleCopyEmail}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-slate-200 hover:bg-slate-300 rounded text-slate-700 font-medium cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </li>
              <li>
                Click <strong className="text-slate-900">Save</strong>. Then return here, click <strong>Sign in with Google</strong>, click <em>Advanced</em> &rarr; <em>Go to DriveFetch (unsafe)</em> to proceed.
              </li>
            </ol>
          </div>

          {/* Option 3: Custom Token */}
          <div className="border border-slate-200 bg-white rounded-lg p-4 text-xs space-y-2.5">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Key className="w-4 h-4 text-slate-600" />
              <span>Option 3: Use Temporary Access Token</span>
            </div>
            <p className="text-slate-600">
              Already have an OAuth 2.0 access token (e.g. from Google OAuth Playground or <code className="bg-slate-100 px-1 py-0.5 rounded">gcloud auth print-access-token</code>)?
            </p>
            <form onSubmit={handleApplyToken} className="flex gap-2">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste Bearer token (ya29....)"
                className="flex-1 px-3 py-1.5 text-xs font-mono border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <button
                type="submit"
                disabled={!tokenInput.trim()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded font-medium disabled:opacity-50 cursor-pointer"
              >
                Apply Token
              </button>
            </form>
            {tokenSuccess && (
              <p className="text-green-600 font-medium text-[11px] flex items-center gap-1">
                <Check className="w-3 h-3" /> Token applied successfully!
              </p>
            )}
            {hasCustomToken && !tokenSuccess && (
              <p className="text-blue-600 text-[11px]">
                Active custom token is currently being used for requests.
              </p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            I Understand, Continue
          </button>
        </div>
      </div>
    </div>
  );
};
