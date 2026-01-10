import { useState, useCallback, useEffect } from 'react';
import { TexInfo, WasmModule } from '../wasm';
import { downloadFile, getMimeType } from '../download';

interface TexViewerProps {
  fileName: string;
  bytes: Uint8Array;
  texInfo: TexInfo;
  wasm: WasmModule;
  onProgress: (message: string, percent: number) => void;
  onComplete: () => void;
  onError: (message: string) => void;
}

export function TexViewer({
  fileName,
  bytes,
  texInfo,
  wasm,
  onProgress,
  onComplete,
  onError,
}: TexViewerProps) {
  const [outputFormat, setOutputFormat] = useState(() => {
    if (texInfo.is_video) return 'mp4';
    if (texInfo.is_gif) return 'gif';
    return 'png';
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // Generate preview on mount
  useEffect(() => {
    let cancelled = false;

    async function generatePreview() {
      try {
        const result = wasm.convert_tex_auto(bytes);
        if (cancelled) return;

        const blob = new Blob([new Uint8Array(result.data)], { type: result.mime_type });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch (err) {
        console.error('Preview generation failed:', err);
      }
    }

    generatePreview();

    return () => {
      cancelled = true;
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [bytes, wasm]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = useCallback(async () => {
    setIsConverting(true);

    try {
      onProgress('Converting...', 30);

      const data = wasm.convert_tex(bytes, outputFormat);

      onProgress('Downloading...', 80);

      const outputName = fileName.replace(/\.tex$/i, `.${outputFormat}`);
      downloadFile(data, outputName, getMimeType(outputFormat));

      onProgress('Done!', 100);
      onComplete();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setIsConverting(false);
    }
  }, [bytes, wasm, outputFormat, fileName, onProgress, onComplete, onError]);

  // Determine available formats based on texture type
  const availableFormats = texInfo.is_video
    ? [{ value: 'mp4', label: 'MP4' }]
    : [
        { value: 'png', label: 'PNG' },
        { value: 'jpg', label: 'JPEG' },
        { value: 'webp', label: 'WebP' },
        { value: 'gif', label: 'GIF' },
        { value: 'bmp', label: 'BMP' },
        { value: 'tiff', label: 'TIFF' },
      ];

  return (
    <div className="mt-8">
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Texture Preview</h2>

        {/* Preview */}
        <div className="mb-4 bg-gray-900 rounded-lg p-4 flex justify-center items-center min-h-48">
          {previewUrl ? (
            texInfo.is_video ? (
              <video
                src={previewUrl}
                controls
                className="max-w-full max-h-96"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Texture preview"
                className="max-w-full max-h-96 object-contain"
              />
            )
          ) : (
            <div className="text-gray-500">Generating preview...</div>
          )}
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
          <div className="bg-gray-900 rounded-lg p-3">
            <div className="text-gray-400 text-xs">Dimensions</div>
            <div className="font-medium">
              {texInfo.width} x {texInfo.height}
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3">
            <div className="text-gray-400 text-xs">Format</div>
            <div className="font-medium">{texInfo.format}</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3">
            <div className="text-gray-400 text-xs">Type</div>
            <div className="font-medium">
              {texInfo.is_video ? 'Video' : texInfo.is_gif ? 'Animation' : 'Static'}
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3">
            <div className="text-gray-400 text-xs">Mipmaps</div>
            <div className="font-medium">{texInfo.mipmap_count}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Format:</label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="bg-gray-700 rounded px-3 py-1 text-sm border-none focus:ring-2 focus:ring-blue-500"
              disabled={texInfo.is_video}
            >
              {availableFormats.map((fmt) => (
                <option key={fmt.value} value={fmt.value}>
                  {fmt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleDownload}
            disabled={isConverting}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {isConverting ? 'Converting...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
