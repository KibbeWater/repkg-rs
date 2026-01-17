import { useState, useCallback, useEffect } from 'react';
import { TexInfo, WasmModule } from '../wasm';
import { downloadFile, getMimeType } from '../download';
import { logConversion } from '../logger';

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
    const startTime = performance.now();

    try {
      onProgress('Converting...', 30);

      const data = wasm.convert_tex(bytes, outputFormat);
      logConversion(outputFormat, bytes.length, data.length, startTime);

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
    <div className="mt-8 animate-fade-in">
      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Texture Preview
        </h2>

        {/* Preview */}
        <div className="mb-4 bg-slate-950/50 rounded-xl p-4 flex justify-center items-center min-h-48 border border-white/5">
          {previewUrl ? (
            texInfo.is_video ? (
              <video
                src={previewUrl}
                controls
                className="max-w-full max-h-96 rounded-lg"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Texture preview"
                className="max-w-full max-h-96 object-contain rounded-lg"
              />
            )
          ) : (
            <div className="flex items-center gap-2 text-slate-500">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating preview...
            </div>
          )}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
            <div className="text-slate-500 text-xs mb-1">Dimensions</div>
            <div className="font-semibold text-white">
              {texInfo.width} x {texInfo.height}
            </div>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
            <div className="text-slate-500 text-xs mb-1">Format</div>
            <div className="font-semibold text-white">{texInfo.format}</div>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
            <div className="text-slate-500 text-xs mb-1">Type</div>
            <div className="font-semibold text-white">
              {texInfo.is_video ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                  Video
                </span>
              ) : texInfo.is_gif ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-500"></span>
                  Animation
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                  Static
                </span>
              )}
            </div>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
            <div className="text-slate-500 text-xs mb-1">Mipmaps</div>
            <div className="font-semibold text-white">{texInfo.mipmap_count}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 items-center pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Format:</label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="select"
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
            className="btn-primary"
          >
            {isConverting ? 'Converting...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
