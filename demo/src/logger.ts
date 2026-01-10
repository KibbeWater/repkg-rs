// Console logger with styled output for technical logs

const STYLES = {
  header: 'color: #60a5fa; font-weight: bold; font-size: 14px;',
  label: 'color: #9ca3af;',
  value: 'color: #34d399; font-weight: bold;',
  dim: 'color: #6b7280;',
  warn: 'color: #fbbf24;',
  success: 'color: #10b981; font-weight: bold;',
  info: 'color: #60a5fa;',
  data: 'color: #c084fc;',
};

export function logBanner() {
  console.log(
    `%c
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██████╗ ███████╗██████╗ ██╗  ██╗ ██████╗               ║
║   ██╔══██╗██╔════╝██╔══██╗██║ ██╔╝██╔════╝               ║
║   ██████╔╝█████╗  ██████╔╝█████╔╝ ██║  ███╗              ║
║   ██╔══██╗██╔══╝  ██╔═══╝ ██╔═██╗ ██║   ██║              ║
║   ██║  ██║███████╗██║     ██║  ██╗╚██████╔╝              ║
║   ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝ ╚═════╝               ║
║                                                           ║
║   Wallpaper Engine PKG/TEX Converter                      ║
║   Powered by Rust + WebAssembly                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`,
    'color: #60a5fa; font-family: monospace;'
  );
}

export function logWasmInit(startTime: number) {
  const elapsed = performance.now() - startTime;
  console.log(
    `%c[WASM] %cModule ready %c(${elapsed.toFixed(2)}ms)`,
    STYLES.label,
    STYLES.success,
    STYLES.dim
  );
}

export function logFileLoad(name: string, size: number) {
  console.group(`%c[FILE] %c${name}`, STYLES.label, STYLES.header);
  console.log(
    `%c  Size: %c${formatBytes(size)}`,
    STYLES.dim,
    STYLES.value
  );
  console.log(
    `%c  Type: %c${name.split('.').pop()?.toUpperCase()}`,
    STYLES.dim,
    STYLES.value
  );
}

export function logPkgParse(magic: string, entryCount: number, entries: { path: string; size: number; entry_type: string }[]) {
  console.log(`%c  Magic: %c${magic}`, STYLES.dim, STYLES.data);
  console.log(`%c  Entries: %c${entryCount}`, STYLES.dim, STYLES.value);
  
  const byType = entries.reduce((acc, e) => {
    acc[e.entry_type] = (acc[e.entry_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log(`%c  Breakdown:`, STYLES.dim);
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`%c    ${type}: %c${count}`, STYLES.dim, STYLES.value);
  });
  
  const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
  console.log(`%c  Total data: %c${formatBytes(totalSize)}`, STYLES.dim, STYLES.value);
  console.groupEnd();
}

export function logTexParse(info: {
  width: number;
  height: number;
  format: string;
  is_gif: boolean;
  is_video: boolean;
  mipmap_count: number;
}) {
  console.log(`%c  Dimensions: %c${info.width}x${info.height}`, STYLES.dim, STYLES.value);
  console.log(`%c  Format: %c${info.format}`, STYLES.dim, STYLES.data);
  console.log(`%c  Type: %c${info.is_video ? 'Video' : info.is_gif ? 'Animation' : 'Static'}`, STYLES.dim, STYLES.value);
  console.log(`%c  Mipmaps: %c${info.mipmap_count}`, STYLES.dim, STYLES.value);
  console.groupEnd();
}

export function logExtraction(count: number, startTime: number) {
  const elapsed = performance.now() - startTime;
  console.log(
    `%c[EXTRACT] %cProcessed %c${count} files %cin ${elapsed.toFixed(2)}ms`,
    STYLES.label,
    STYLES.dim,
    STYLES.value,
    STYLES.dim
  );
}

export function logConversion(format: string, inputSize: number, outputSize: number, startTime: number) {
  const elapsed = performance.now() - startTime;
  const ratio = ((outputSize / inputSize) * 100).toFixed(1);
  console.log(
    `%c[CONVERT] %c${format.toUpperCase()} %c${formatBytes(inputSize)} → ${formatBytes(outputSize)} %c(${ratio}%) %c${elapsed.toFixed(2)}ms`,
    STYLES.label,
    STYLES.value,
    STYLES.dim,
    STYLES.info,
    STYLES.dim
  );
}

export function logError(message: string) {
  console.log(`%c[ERROR] %c${message}`, STYLES.label, STYLES.warn);
}

// WASM callback handler - receives logs directly from Rust
export function handleWasmLog(level: string, operation: string, data: Record<string, unknown>) {
  const opStyles: Record<string, string> = {
    pkg_parse: 'color: #f472b6;',      // pink
    pkg_extract: 'color: #fb923c;',    // orange
    tex_parse: 'color: #a78bfa;',      // purple
    tex_convert: 'color: #4ade80;',    // green
    tex_convert_auto: 'color: #4ade80;', // green
  };

  const style = opStyles[operation] || STYLES.data;
  const levelIcon = level === 'debug' ? '🔧' : level === 'info' ? '📊' : '⚠️';

  console.group(`%c${levelIcon} [WASM:${operation}]`, style);

  // Format the data nicely based on operation type
  switch (operation) {
    case 'pkg_parse':
      console.log(`%cMagic: %c${data.magic} %c(${data.version})`, STYLES.dim, STYLES.value, STYLES.dim);
      console.log(`%cHeader: %c${formatBytes(data.header_size_bytes as number)}`, STYLES.dim, STYLES.value);
      console.log(`%cEntries: %c${data.entry_count} %c(${formatBytes(data.total_data_bytes as number)} total)`, STYLES.dim, STYLES.value, STYLES.dim);
      console.log(`%c  TEX: %c${data.texture_count}%c, JSON: %c${data.json_count}%c, Shader: %c${data.shader_count}%c, Other: %c${data.other_count}`,
        STYLES.dim, STYLES.value, STYLES.dim, STYLES.value, STYLES.dim, STYLES.value, STYLES.dim, STYLES.value);
      break;

    case 'tex_parse':
      console.log(`%cContainer: %c${data.container_version}`, STYLES.dim, STYLES.data);
      console.log(`%cFormat: %c${data.format} %c→ %c${data.image_format}`, STYLES.dim, STYLES.value, STYLES.dim, STYLES.data);
      console.log(`%cDimensions: %c${data.dimensions} %c(texture: ${data.texture_dimensions})`, STYLES.dim, STYLES.value, STYLES.dim);
      console.log(`%cMipmaps: %c${data.mipmap_count} %c(${formatBytes(data.total_mipmap_bytes as number)})`, STYLES.dim, STYLES.value, STYLES.dim);
      console.log(`%cLZ4 Compressed: %c${data.is_lz4_compressed ? 'Yes' : 'No'}`, STYLES.dim, data.is_lz4_compressed ? STYLES.success : STYLES.dim);
      console.log(`%cFlags: %c0x${(data.flags as number).toString(16).padStart(8, '0')}`, STYLES.dim, STYLES.dim);
      break;

    case 'tex_convert':
    case 'tex_convert_auto':
      console.log(`%c${data.input_format} → ${data.output_format}`, STYLES.value);
      console.log(`%cDimensions: %c${data.dimensions}`, STYLES.dim, STYLES.value);
      console.log(`%cSize: %c${formatBytes(data.input_bytes as number)} → ${formatBytes(data.output_bytes as number)}`, STYLES.dim, STYLES.value);
      const ratio = ((data.compression_ratio as number) * 100).toFixed(1);
      const ratioStyle = (data.compression_ratio as number) < 1 ? STYLES.success : STYLES.warn;
      console.log(`%cRatio: %c${ratio}%`, STYLES.dim, ratioStyle);
      break;

    case 'pkg_extract':
      console.log(`%cExtracted: %c${data.entry_count} files %c(${formatBytes(data.total_bytes as number)})`, STYLES.dim, STYLES.value, STYLES.dim);
      break;

    default:
      // Generic fallback - just dump the data
      Object.entries(data).forEach(([key, value]) => {
        console.log(`%c${key}: %c${JSON.stringify(value)}`, STYLES.dim, STYLES.value);
      });
  }

  console.groupEnd();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
