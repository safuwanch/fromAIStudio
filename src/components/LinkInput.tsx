import React, { useState, useId } from 'react';
import { Sparkles, Trash2, ArrowRight, FileText } from 'lucide-react';
import { extractDriveLinks } from '../services/drive';

interface LinkInputProps {
  onAddLinks: (linksText: string) => Promise<void>;
  isLoading: boolean;
}

export const LinkInput: React.FC<LinkInputProps> = ({ onAddLinks, isLoading }) => {
  const [text, setText] = useState('');
  const textareaId = useId();

  const detectedLinks = extractDriveLinks(text);

  const handlePasteSample = () => {
    const sample = [
      'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing',
      'https://docs.google.com/document/d/195j9eXO07-3WVgxm85FWQEENdZwpjKRX4NdOWkyC350/edit',
      'https://drive.google.com/open?id=1sample_Spreadsheet_ID_999888777666',
    ].join('\n');
    setText(sample);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isLoading) return;
    await onAddLinks(text);
  };

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <label htmlFor={textareaId} className="text-sm font-semibold text-slate-700">
              Input Google Drive URLs
            </label>
            <p className="text-xs text-slate-500">
              Paste one link per line. Private files require authenticated session.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePasteSample}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fill Sample Links</span>
            </button>
            {text && (
              <button
                type="button"
                onClick={() => setText('')}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        <textarea
          id={textareaId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`https://drive.google.com/file/d/1XyZ987-Alpha_Project_Assets\nhttps://drive.google.com/file/d/2AbC456-Marketing_Video_Final\nhttps://drive.google.com/drive/folders/3DeF789-Quarterly_Reports`}
          className="w-full h-32 p-4 text-sm font-mono border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-xs outline-none resize-none placeholder:text-slate-400"
        />

        <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {detectedLinks.length === 0 ? (
                '0 valid links detected'
              ) : (
                <span className="text-slate-700 font-medium">
                  {detectedLinks.length} item{detectedLinks.length === 1 ? '' : 's'} detected
                  {detectedLinks.some((l) => l.isFolder) && ' (with folders)'}
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {text && (
              <button
                type="button"
                onClick={() => setText('')}
                className="px-4 py-2 bg-white text-slate-700 text-sm font-medium border border-slate-300 rounded hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Clear All Links
              </button>
            )}
            <button
              type="submit"
              disabled={detectedLinks.length === 0 || isLoading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded shadow-xs hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Inspecting URLs...</span>
                </>
              ) : (
                <>
                  <span>Load Into Queue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

