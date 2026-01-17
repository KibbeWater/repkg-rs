import { useState, useCallback } from 'react';
import { loadWasm, PkgInfo, TexInfo, WasmModule } from './wasm';
import { DropZone } from './components/DropZone';
import { ProgressBar } from './components/ProgressBar';
import { PkgViewer } from './components/PkgViewer';
import { TexViewer } from './components/TexViewer';
import { ErrorToast } from './components/ErrorToast';
import { Hero } from './components/Hero';
import { FindFiles } from './components/FindFiles';
import { Features } from './components/Features';
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

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'pkg' && ext !== 'tex') {
        throw new Error('Please select a .pkg or .tex file');
      }

      const fileType: FileType = ext as FileType;

      let wasmModule = wasm;
      if (!wasmModule) {
        setProgress({ message: 'Loading WebAssembly module...', percent: 0 });
        wasmModule = await loadWasm((message, percent) => {
          setProgress({ message, percent });
        });
        setWasm(wasmModule);
      }

      setProgress({ message: 'Reading file...', percent: 20 });
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      logFileLoad(file.name, bytes.length);

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
    <div className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(139, 92, 246, 0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Progress Bar */}
      {progress && (
        <ProgressBar message={progress.message} percent={progress.percent} />
      )}

      {/* Error Toast */}
      {error && (
        <ErrorToast message={error} onClose={() => setError(null)} />
      )}

      {/* Main Content */}
      <div className="relative container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section */}
        <Hero />

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

        {/* Find Files Guide */}
        <FindFiles />

        {/* Features */}
        <Features />

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-slate-500">
            Made with Rust + WebAssembly
            <span className="mx-2 text-slate-700">|</span>
            <a
              href="https://github.com/KibbeWater/repkg-rs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 transition-colors"
            >
              Open Source
            </a>
            <span className="mx-2 text-slate-700">|</span>
            Files never leave your browser
          </p>
        </footer>
      </div>
    </div>
  );
}
