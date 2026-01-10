import { useState, useCallback } from 'react';
import { loadWasm, PkgInfo, TexInfo, WasmModule } from './wasm';
import { DropZone } from './components/DropZone';
import { ProgressBar } from './components/ProgressBar';
import { PkgViewer } from './components/PkgViewer';
import { TexViewer } from './components/TexViewer';
import { ErrorToast } from './components/ErrorToast';
import { logFileLoad, logPkgParse, logTexParse } from './logger';

type FileType = 'pkg' | 'tex' | null;

interface LoadedFile {
  name: string;
  type: FileType;
  bytes: Uint8Array;
  pkgInfo?: PkgInfo;
  texInfo?: TexInfo;
}

export default function App() {
  const [progress, setProgress] = useState<{ message: string; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null);
  const [wasm, setWasm] = useState<WasmModule | null>(null);

  const handleFile = useCallback(async (file: File) => {
    try {
      setError(null);
      setLoadedFile(null);

      // Determine file type
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'pkg' && ext !== 'tex') {
        throw new Error('Please select a .pkg or .tex file');
      }

      const fileType: FileType = ext as FileType;

      // Load WASM if needed
      let wasmModule = wasm;
      if (!wasmModule) {
        setProgress({ message: 'Loading WebAssembly module...', percent: 0 });
        wasmModule = await loadWasm((message, percent) => {
          setProgress({ message, percent });
        });
        setWasm(wasmModule);
      }

      // Read file
      setProgress({ message: 'Reading file...', percent: 20 });
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Log file info
      logFileLoad(file.name, bytes.length);

      // Parse file
      setProgress({ message: 'Parsing file...', percent: 50 });

      if (fileType === 'pkg') {
        const pkgInfo = wasmModule.parse_pkg(bytes);
        logPkgParse(pkgInfo.magic, pkgInfo.entry_count, pkgInfo.entries);
        setProgress({ message: 'Done!', percent: 100 });
        setLoadedFile({
          name: file.name,
          type: 'pkg',
          bytes,
          pkgInfo,
        });
      } else {
        const texInfo = wasmModule.parse_tex(bytes);
        logTexParse(texInfo);
        setProgress({ message: 'Done!', percent: 100 });
        setLoadedFile({
          name: file.name,
          type: 'tex',
          bytes,
          texInfo,
        });
      }

      // Hide progress after a short delay
      setTimeout(() => setProgress(null), 500);
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  }, [wasm]);

  const handleProgress = useCallback((message: string, percent: number) => {
    setProgress({ message, percent });
  }, []);

  const handleProgressComplete = useCallback(() => {
    setTimeout(() => setProgress(null), 500);
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Progress Bar */}
      {progress && (
        <ProgressBar message={progress.message} percent={progress.percent} />
      )}

      {/* Error Toast */}
      {error && (
        <ErrorToast message={error} onClose={() => setError(null)} />
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">repkg-rs</h1>
          <p className="text-gray-400">Wallpaper Engine PKG/TEX Converter</p>
          <p className="text-sm text-gray-500 mt-2">
            <a
              href="https://github.com/KibbeWater/repkg-rs"
              className="text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </p>
        </header>

        {/* Drop Zone */}
        <DropZone onFile={handleFile} />

        {/* Results */}
        {loadedFile && loadedFile.type === 'pkg' && loadedFile.pkgInfo && wasm && (
          <PkgViewer
            fileName={loadedFile.name}
            bytes={loadedFile.bytes}
            pkgInfo={loadedFile.pkgInfo}
            wasm={wasm}
            onProgress={handleProgress}
            onComplete={handleProgressComplete}
            onError={handleError}
          />
        )}

        {loadedFile && loadedFile.type === 'tex' && loadedFile.texInfo && wasm && (
          <TexViewer
            fileName={loadedFile.name}
            bytes={loadedFile.bytes}
            texInfo={loadedFile.texInfo}
            wasm={wasm}
            onProgress={handleProgress}
            onComplete={handleProgressComplete}
            onError={handleError}
          />
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>Built with Rust + WebAssembly</p>
          <p className="mt-1">Files are processed entirely in your browser - nothing is uploaded.</p>
        </footer>
      </div>
    </div>
  );
}
