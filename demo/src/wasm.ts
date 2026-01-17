import { logBanner, logWasmInit, handleWasmLog } from './logger';

// Types for WASM module
export interface PkgEntryInfo {
  path: string;
  size: number;
  entry_type: string;
}

export interface PkgInfo {
  magic: string;
  entry_count: number;
  entries: PkgEntryInfo[];
}

export interface TexInfo {
  width: number;
  height: number;
  texture_width: number;
  texture_height: number;
  format: string;
  is_gif: boolean;
  is_video: boolean;
  mipmap_count: number;
}

export interface ExtractedFile {
  path: string;
  data: Uint8Array;
}

export interface ConvertResult {
  data: Uint8Array;
  format: string;
  mime_type: string;
  take_data(): Uint8Array;
}

export interface VideoDataInfo {
  is_video: boolean;
  data_offset: number;
  data_size: number;
}

export interface WasmModule {
  parse_pkg(bytes: Uint8Array): PkgInfo;
  extract_pkg_entry(bytes: Uint8Array, path: string): Uint8Array;
  extract_all_pkg(bytes: Uint8Array): ExtractedFile[];
  extract_selected_pkg(bytes: Uint8Array, paths: string[]): ExtractedFile[];
  parse_tex(bytes: Uint8Array): TexInfo;
  convert_tex(bytes: Uint8Array, format: string): Uint8Array;
  convert_tex_auto(bytes: Uint8Array): ConvertResult;
  get_video_data_location(bytes: Uint8Array): VideoDataInfo;
}

let wasmModule: WasmModule | null = null;
let loadingPromise: Promise<WasmModule> | null = null;

export async function loadWasm(
  onProgress?: (message: string, percent: number) => void
): Promise<WasmModule> {
  if (wasmModule) {
    return wasmModule;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const startTime = performance.now();
    
    logBanner();
    console.log('%c[WASM] %cLoading module...', 'color: #9ca3af;', 'color: #60a5fa;');
    
    onProgress?.('Loading WebAssembly module...', 10);

    // Dynamic import of the WASM package
    const wasm = await import('../pkg/repkg_wasm.js');
    
    onProgress?.('Initializing...', 50);
    
    // Initialize the WASM module
    await wasm.default();
    
    // Register log callback if available (requires console-log feature)
    if (typeof wasm.set_log_callback === 'function') {
      wasm.set_log_callback(handleWasmLog);
      console.log('%c[WASM] %cLog callback registered', 'color: #9ca3af;', 'color: #10b981;');
    }
    
    logWasmInit(startTime);
    
    onProgress?.('Ready!', 100);

    wasmModule = wasm as unknown as WasmModule;
    return wasmModule;
  })();

  return loadingPromise;
}

export function isWasmLoaded(): boolean {
  return wasmModule !== null;
}

export function getWasm(): WasmModule | null {
  return wasmModule;
}
