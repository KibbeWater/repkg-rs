interface ProgressBarProps {
  message: string;
  percent: number;
}

export function ProgressBar({ message, percent }: ProgressBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-gray-800 p-4 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between text-sm mb-2">
            <span>{message}</span>
            <span>{Math.round(percent)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
