import { useCallback, useRef, useState } from 'react';

interface DropZoneProps {
  onFile: (file: File) => void;
}

export function DropZone({ onFile }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        onFile(file);
      }
    },
    [onFile]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFile(file);
      }
      e.target.value = '';
    },
    [onFile]
  );

  return (
    <div className="relative group">
      {/* Animated gradient border */}
      <div 
        className={`
          absolute -inset-0.5 rounded-2xl opacity-0 blur-sm transition-all duration-500
          bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500
          ${isDragging ? 'opacity-100' : 'group-hover:opacity-60'}
        `}
        style={{ backgroundSize: '200% 200%', animation: 'gradient 3s ease infinite' }}
      />
      
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative glass-card p-10 text-center cursor-pointer
          transition-all duration-300
          ${isDragging 
            ? 'bg-violet-500/10 scale-[1.01]' 
            : 'hover:bg-slate-800/60'
          }
        `}
      >
        {/* Upload icon */}
        <div className={`
          relative mx-auto w-20 h-20 mb-5 rounded-2xl 
          bg-gradient-to-br from-slate-800 to-slate-900
          border border-white/5
          flex items-center justify-center
          transition-all duration-300
          ${isDragging ? 'scale-110 border-violet-500/50' : 'group-hover:scale-105'}
        `}>
          {/* Glow effect */}
          <div className={`
            absolute inset-0 rounded-2xl bg-violet-500/20 blur-xl
            transition-opacity duration-300
            ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}
          `} />
          
          <svg 
            className={`
              w-10 h-10 transition-all duration-300 relative z-10
              ${isDragging ? 'text-violet-400 scale-110' : 'text-slate-400 group-hover:text-violet-400'}
            `}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={1.5}
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
            />
          </svg>
        </div>

        {/* Text */}
        <p className="text-lg font-medium text-white mb-1">
          {isDragging ? 'Drop your file here' : 'Drop .pkg or .tex file here'}
        </p>
        <p className="text-sm text-slate-400 mb-4">or click to browse your files</p>
        
        {/* Supported formats */}
        <div className="flex items-center justify-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-slate-800/50 border border-white/5 text-xs text-slate-400 font-mono">
            .pkg
          </span>
          <span className="px-3 py-1 rounded-lg bg-slate-800/50 border border-white/5 text-xs text-slate-400 font-mono">
            .tex
          </span>
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pkg,.tex"
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
