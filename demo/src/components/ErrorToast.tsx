interface ErrorToastProps {
  message: string;
  onClose: () => void;
}

export function ErrorToast({ message, onClose }: ErrorToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-up">
      <div className="bg-red-500/10 backdrop-blur-md text-white px-5 py-4 rounded-xl shadow-lg max-w-md border border-red-500/20">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-red-200">Something went wrong</p>
            <p className="text-sm mt-1 text-red-100/80">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-red-300/60 hover:text-red-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
