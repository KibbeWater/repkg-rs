import { useState, useCallback } from 'react';
import { loadWasm, PkgInfo, TexInfo, WasmModule } from './wasm';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { DropZone } from './components/DropZone';
import { ProgressBar } from './components/ProgressBar';
import { PkgViewer } from './components/PkgViewer';
import { TexViewer } from './components/TexViewer';
import { ErrorToast } from './components/ErrorToast';
import { Hero } from './components/Hero';
import { FindFiles } from './components/FindFiles';
import { Features } from './components/Features';
import { UserMenu } from './components/auth/UserMenu';
import { LoginButton } from './components/auth/LoginButton';
import { WorkshopDownloader } from './components/workshop/WorkshopDownloader';
import { logFileLoad, logPkgParse, logTexParse } from './logger';

type FileType = 'pkg' | 'tex' | null;
type InputMode = 'local' | 'workshop';

interface LoadedFile {
  name: string;
  type: FileType;
  bytes: Uint8Array;
  pkgInfo?: PkgInfo;
  texInfo?: TexInfo;
}

function AppContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [progress, setProgress] = useState<{ message: string; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null);
  const [wasm, setWasm] = useState<WasmModule | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('local');

  const processBytes = useCallback(async (bytes: Uint8Array, filename: string) => {
    try {
      setError(null);
      setLoadedFile(null);

      const ext = filename.split('.').pop()?.toLowerCase();
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

      setProgress({ message: 'Parsing file...', percent: 50 });

      if (fileType === 'pkg') {
        const pkgInfo = wasmModule.parse_pkg(bytes);
        logPkgParse(pkgInfo.magic, pkgInfo.entry_count, pkgInfo.entries);
        setProgress({ message: 'Done!', percent: 100 });
        setLoadedFile({
          name: filename,
          type: 'pkg',
          bytes,
          pkgInfo,
        });
      } else {
        const texInfo = wasmModule.parse_tex(bytes);
        logTexParse(texInfo);
        setProgress({ message: 'Done!', percent: 100 });
        setLoadedFile({
          name: filename,
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

  const handleFile = useCallback(async (file: File) => {
    setProgress({ message: 'Reading file...', percent: 20 });
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    logFileLoad(file.name, bytes.length);
    await processBytes(bytes, file.name);
  }, [processBytes]);

  const handleWorkshopFile = useCallback(async (data: Uint8Array, filename: string) => {
    logFileLoad(filename, data.length);
    await processBytes(data, filename);
  }, [processBytes]);

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

      {/* Header with Auth */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-sm border-b border-white/5">
        <div className="container mx-auto px-4 py-3 max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <span className="font-semibold text-white">repkg-rs</span>
          </div>
          
          {/* Auth Section */}
          {!authLoading && (
            isAuthenticated ? (
              <UserMenu />
            ) : (
              <LoginButton compact />
            )
          )}
        </div>
      </header>

      {/* Progress Bar */}
      {progress && (
        <ProgressBar message={progress.message} percent={progress.percent} />
      )}

      {/* Error Toast */}
      {error && (
        <ErrorToast message={error} onClose={() => setError(null)} />
      )}

      {/* Main Content */}
      <div className="relative container mx-auto px-4 pt-20 pb-12 max-w-4xl">
        {/* Hero Section */}
        <Hero />

        {/* Mode Switcher */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 rounded-xl bg-slate-800/50 backdrop-blur-sm border border-white/5">
            <button
              onClick={() => setInputMode('local')}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${inputMode === 'local'
                  ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }
              `}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Local File
              </span>
            </button>
            <button
              onClick={() => setInputMode('workshop')}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${inputMode === 'workshop'
                  ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }
              `}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                Steam Workshop
              </span>
            </button>
          </div>
        </div>

        {/* Input Section */}
        {inputMode === 'local' ? (
          <DropZone onFile={handleFile} />
        ) : (
          <WorkshopDownloader
            onFileReady={handleWorkshopFile}
            onError={handleError}
            onProgress={handleProgress}
          />
        )}

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

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
