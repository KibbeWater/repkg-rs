// Workshop ID Input Component

import { useState, FormEvent } from 'react';

interface WorkshopInputProps {
  onSubmit: (workshopId: number) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function WorkshopInput({
  onSubmit,
  disabled,
  isLoading,
}: WorkshopInputProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Parse workshop ID from URL or direct input
  const parseWorkshopId = (value: string): number | null => {
    const trimmed = value.trim();

    // Handle direct numeric ID
    const directId = parseInt(trimmed, 10);
    if (!isNaN(directId) && directId > 0 && String(directId) === trimmed) {
      return directId;
    }

    // Handle Steam Workshop URL patterns:
    // https://steamcommunity.com/sharedfiles/filedetails/?id=123456
    // https://steamcommunity.com/workshop/filedetails/?id=123456
    const urlMatch = trimmed.match(/[?&]id=(\d+)/);
    if (urlMatch) {
      const id = parseInt(urlMatch[1], 10);
      if (!isNaN(id) && id > 0) {
        return id;
      }
    }

    return null;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const workshopId = parseWorkshopId(input);
    if (!workshopId) {
      setError('Please enter a valid Workshop ID or URL');
      return;
    }

    onSubmit(workshopId);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            placeholder="Workshop ID or URL (e.g., 123456789)"
            disabled={disabled || isLoading}
            className={`
              w-full px-4 py-3 rounded-xl
              bg-slate-800/50 backdrop-blur-sm
              border transition-all duration-200
              text-white placeholder-slate-500
              focus:outline-none focus:ring-2 focus:ring-violet-500/50
              disabled:opacity-50 disabled:cursor-not-allowed
              ${error ? 'border-red-500/50' : 'border-white/10 focus:border-violet-500/50'}
            `}
          />
          {/* Steam icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className="w-5 h-5 text-slate-500"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3l-.5 3H13v6.95c5.05-.5 9-4.76 9-9.95 0-5.52-4.48-10-10-10z" />
            </svg>
          </div>
        </div>

        <button
          type="submit"
          disabled={disabled || isLoading || !input.trim()}
          className={`
            px-6 py-3 rounded-xl font-medium
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              isLoading
                ? 'bg-violet-600/50'
                : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40'
            }
          `}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Queueing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download
            </span>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </p>
      )}

      <p className="mt-3 text-xs text-slate-500 text-center">
        Enter a Steam Workshop item ID or paste the full URL
      </p>
    </form>
  );
}
