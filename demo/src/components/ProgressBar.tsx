interface ProgressBarProps {
  message: string;
  percent: number;
}

export function ProgressBar({ message, percent }: ProgressBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-slate-900/95 backdrop-blur-md p-4 shadow-lg border-b border-white/5">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white font-medium">{message}</span>
            <span className="text-violet-400 font-mono">{Math.round(percent)}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-2 rounded-full transition-all duration-200 relative"
              style={{ width: `${percent}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: '200% 100%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
