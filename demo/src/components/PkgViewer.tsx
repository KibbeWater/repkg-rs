import { useState, useCallback, useMemo } from 'react';
import { PkgInfo, WasmModule } from '../wasm';
import { downloadAsZip, formatFileSize, getMimeType } from '../download';

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

    try {
      onProgress('Extracting files...', 0);

      const paths = Array.from(selectedPaths);
      const extracted = wasm.extract_selected_pkg(bytes, paths);

      onProgress('Converting textures...', 30);

      // Convert TEX files to images
      const filesToZip = [];
      for (let i = 0; i < extracted.length; i++) {
        const file = extracted[i];
        let data = file.data;
        let path = file.path;

        // Convert .tex files
        if (path.toLowerCase().endsWith('.tex')) {
          try {
            data = wasm.convert_tex(data, outputFormat);
            path = path.replace(/\.tex$/i, `.${outputFormat}`);
          } catch (err) {
            console.warn(`Failed to convert ${file.path}:`, err);
            // Keep original .tex file if conversion fails
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
        return '🖼️';
      case 'json':
        return '📄';
      case 'shader':
        return '✨';
      default:
        return '📁';
    }
  };

  return (
    <div className="mt-8">
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Package Contents</h2>
          <span className="text-sm text-gray-400">
            {pkgInfo.entry_count} files, {formatFileSize(totalSize)}
          </span>
        </div>

        {/* Selection Controls */}
        <div className="flex gap-4 mb-3">
          <button
            onClick={selectAll}
            className="text-sm text-blue-400 hover:underline"
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            className="text-sm text-blue-400 hover:underline"
          >
            Deselect All
          </button>
          {textureCount > 0 && (
            <button
              onClick={selectTextures}
              className="text-sm text-blue-400 hover:underline"
            >
              Select Textures ({textureCount})
            </button>
          )}
        </div>

        {/* Entry List */}
        <div className="max-h-80 overflow-y-auto space-y-1 bg-gray-900 rounded-lg p-3 mb-4">
          {pkgInfo.entries.map((entry) => (
            <label
              key={entry.path}
              className="flex items-center gap-3 p-2 rounded hover:bg-gray-800 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedPaths.has(entry.path)}
                onChange={() => toggleEntry(entry.path)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
              />
              <span className="text-lg">{getEntryIcon(entry.entry_type)}</span>
              <span className="flex-1 truncate text-sm">{entry.path}</span>
              <span className="text-xs text-gray-500">{formatFileSize(entry.size)}</span>
            </label>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Convert TEX to:</label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="bg-gray-700 rounded px-3 py-1 text-sm border-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="png">PNG</option>
              <option value="jpg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </div>
          <button
            onClick={handleExtract}
            disabled={isExtracting || selectedCount === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {isExtracting
              ? 'Extracting...'
              : `Extract & Download ZIP (${selectedCount} files)`}
          </button>
        </div>
      </div>
    </div>
  );
}
