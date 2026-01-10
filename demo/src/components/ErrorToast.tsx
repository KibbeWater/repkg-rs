interface ErrorToastProps {
  message: string;
  onClose: () => void;
}

export function ErrorToast({ message, onClose }: ErrorToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg max-w-md">
        <div className="flex items-start gap-3">
          <span className="text-xl">&#9888;&#65039;</span>
          <div className="flex-1">
            <p className="font-semibold">Error</p>
            <p className="text-sm mt-1">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-white/80 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  );
}
