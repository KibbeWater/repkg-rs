import { useState, useCallback, useMemo } from 'react';
import { PkgInfo, WasmModule } from '../wasm';
import { downloadAsZip, formatFileSize } from '../download';
import { logExtraction, logConversion } from '../logger';

interface PkgViewerProps {
  fileName: string;
  bytes: Uint8Array;
  pkgInfo: PkgInfo;
  wasm: WasmModule;
  onProgress: (message: string, percent: number) => void;
  onComplete: () => void;
  onError: (message: string) => void;
}

export function PkgViewer({
  fileName,
  bytes,
  pkgInfo,
  wasm,
  onProgress,
  onComplete,
  onError,
}: PkgViewerProps) {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(pkgInfo.entries.map((e) => e.path))
  );
  const [outputFormat, setOutputFormat] = useState('png');
  const [isExtracting, setIsExtracting] = useState(false);

  const totalSize = useMemo(
    () => pkgInfo.entries.reduce((sum, e) => sum + e.size, 0),
    [pkgInfo]
  );

  const selectedCount = selectedPaths.size;
  const textureCount = pkgInfo.entries.filter((e) => e.entry_type === 'texture').length;
  
  const LARGE_FILE_THRESHOLD = 250 * 1024 * 1024;
  const hasLargeFiles = pkgInfo.entries.some((e) => e.size > LARGE_FILE_THRESHOLD);
  const largestFile = Math.max(...pkgInfo.entries.map((e) => e.size));

  const toggleEntry = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedPaths(new Set(pkgInfo.entries.map((e) => e.path)));
  }, [pkgInfo]);

  const selectNone = useCallback(() => {
    setSelectedPaths(new Set());
  }, []);

  const selectTextures = useCallback(() => {
    setSelectedPaths(
      new Set(pkgInfo.entries.filter((e) => e.entry_type === 'texture').map((e) => e.path))
    );
  }, [pkgInfo]);

  const handleExtract = useCallback(async () => {
    if (selectedPaths.size === 0) {
      onError('Please select at least one file to extract');
      return;
    }

    setIsExtracting(true);
    const extractStartTime = performance.now();

    try {
      onProgress('Extracting files...', 0);

      const paths = Array.from(selectedPaths);
      const extracted = wasm.extract_selected_pkg(bytes, paths);
      
      logExtraction(extracted.length, extractStartTime);

      onProgress('Converting textures...', 30);

      const filesToZip = [];
      for (let i = 0; i < extracted.length; i++) {
        const file = extracted[i];
        let data = file.data;
        let path = file.path;

        if (path.toLowerCase().endsWith('.tex')) {
          try {
            const convStartTime = performance.now();
            const inputSize = data.length;
            
            if (inputSize > 10 * 1024 * 1024) {
              const videoInfo = wasm.get_video_data_location(data);
              if (videoInfo.is_video) {
                data = data.slice(videoInfo.data_offset, videoInfo.data_offset + videoInfo.data_size);
                logConversion('mp4', inputSize, data.length, convStartTime);
                path = path.replace(/\.tex$/i, '.mp4');
              } else {
                const result = wasm.convert_tex_auto(data);
                if (result.format !== outputFormat) {
                  data = wasm.convert_tex(data, outputFormat);
                  path = path.replace(/\.tex$/i, `.${outputFormat}`);
                } else {
                  data = result.data;
                  path = path.replace(/\.tex$/i, `.${result.format}`);
                }
                logConversion(outputFormat, inputSize, data.length, convStartTime);
              }
            } else {
              const result = wasm.convert_tex_auto(data);
              const isVideo = result.format === 'mp4';
              
              if (!isVideo && result.format !== outputFormat) {
                data = wasm.convert_tex(data, outputFormat);
                logConversion(outputFormat, inputSize, data.length, convStartTime);
                path = path.replace(/\.tex$/i, `.${outputFormat}`);
              } else {
                data = result.data;
                logConversion(result.format, inputSize, data.length, convStartTime);
                path = path.replace(/\.tex$/i, `.${result.format}`);
              }
            }
          } catch (err) {
            console.warn(`Failed to convert ${file.path}:`, err);
          }
        }

        filesToZip.push({ path, data });
        onProgress(
          `Processing ${i + 1}/${extracted.length}...`,
          30 + ((i + 1) / extracted.length) * 40
        );
      }

      onProgress('Creating ZIP archive...', 70);

      const zipName = fileName.replace(/\.pkg$/i, '') + '_extracted.zip';
      await downloadAsZip(filesToZip, zipName, (percent) => {
        onProgress('Creating ZIP archive...', 70 + percent * 0.3);
      });

      onProgress('Done!', 100);
      onComplete();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setIsExtracting(false);
    }
  }, [selectedPaths, bytes, wasm, outputFormat, fileName, onProgress, onComplete, onError]);

  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'texture':
        return (
          <svg className="w-4 h-4 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'json':
        return (
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'shader':
        return (
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  return (
    <div className="mt-8 animate-fade-in">
      {/* Large File Warning */}
      {hasLargeFiles && (
        <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-medium text-amber-200">Heads up!</p>
              <p className="text-sm text-amber-100/80 mt-1">
                This package contains large files (up to {formatFileSize(largestFile)}). 
                Your browser might run out of memory when extracting. If things don't work, 
                try our{' '}
                <a
                  href="https://github.com/KibbeWater/repkg-rs/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-300 hover:text-amber-200 underline"
                >
                  CLI tool
                </a>
                {' '}instead.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Package Contents
          </h2>
          <span className="text-sm text-slate-400">
            {pkgInfo.entry_count} files, {formatFileSize(totalSize)}
          </span>
        </div>

        {/* Selection Controls */}
        <div className="flex flex-wrap gap-3 mb-3">
          <button
            onClick={selectAll}
            className="text-sm text-violet-400 hover:text-violet-300 hover:underline transition-colors"
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            className="text-sm text-violet-400 hover:text-violet-300 hover:underline transition-colors"
          >
            Deselect All
          </button>
          {textureCount > 0 && (
            <button
              onClick={selectTextures}
              className="text-sm text-violet-400 hover:text-violet-300 hover:underline transition-colors"
            >
              Select Textures ({textureCount})
            </button>
          )}
        </div>

        {/* Entry List */}
        <div className="max-h-80 overflow-y-auto space-y-1 bg-slate-950/50 rounded-xl p-3 mb-4 border border-white/5">
          {pkgInfo.entries.map((entry) => (
            <label
              key={entry.path}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors group"
            >
              <input
                type="checkbox"
                checked={selectedPaths.has(entry.path)}
                onChange={() => toggleEntry(entry.path)}
              />
              <span>{getEntryIcon(entry.entry_type)}</span>
              <span className="flex-1 truncate text-sm text-slate-200 group-hover:text-white transition-colors">{entry.path}</span>
              <span className="text-xs text-slate-500 font-mono">{formatFileSize(entry.size)}</span>
            </label>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 items-center pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Convert TEX to:</label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="select"
            >
              <option value="png">PNG</option>
              <option value="jpg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </div>
          <button
            onClick={handleExtract}
            disabled={isExtracting || selectedCount === 0}
            className="btn-primary"
          >
            {isExtracting
              ? 'Extracting...'
              : `Extract & Download (${selectedCount} files)`}
          </button>
        </div>
      </div>
    </div>
  );
}
