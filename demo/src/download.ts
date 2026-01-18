import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface FileToZip {
  path: string;
  data: Uint8Array;
}

export async function downloadAsZip(
  files: FileToZip[],
  zipName: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const zip = new JSZip();

  // Add files to zip
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    zip.file(file.path, file.data);
    onProgress?.(Math.round(((i + 1) / files.length) * 50));
  }

  // Generate zip
  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE' },
    (metadata) => {
      onProgress?.(50 + Math.round(metadata.percent / 2));
    }
  );

  // Download
  saveAs(blob, zipName);
}

export function downloadFile(
  data: Uint8Array,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([new Uint8Array(data)], { type: mimeType });
  saveAs(blob, filename);
}

export function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    tga: 'image/x-targa',
    mp4: 'video/mp4',
  };
  return mimeTypes[format.toLowerCase()] || 'application/octet-stream';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ExtractedPkg {
  filename: string;
  data: Uint8Array;
}

/**
 * Extract .pkg file from a ZIP archive
 * Returns the first .pkg file found, or throws if none found
 */
export async function extractPkgFromZip(
  zipBlob: Blob,
  onProgress?: (message: string, percent: number) => void
): Promise<ExtractedPkg> {
  onProgress?.('Reading ZIP archive...', 10);
  
  const zip = await JSZip.loadAsync(zipBlob);
  
  // Find all .pkg files in the archive
  const pkgFiles: string[] = [];
  zip.forEach((relativePath, file) => {
    if (!file.dir && relativePath.toLowerCase().endsWith('.pkg')) {
      pkgFiles.push(relativePath);
    }
  });
  
  if (pkgFiles.length === 0) {
    throw new Error('No .pkg file found in the downloaded archive');
  }
  
  // Use the first .pkg file found (or prefer one at root level)
  const pkgPath = pkgFiles.find(p => !p.includes('/')) || pkgFiles[0];
  const pkgFile = zip.file(pkgPath);
  
  if (!pkgFile) {
    throw new Error('Failed to read .pkg file from archive');
  }
  
  onProgress?.('Extracting .pkg file...', 50);
  
  const data = await pkgFile.async('uint8array', (metadata) => {
    onProgress?.('Extracting .pkg file...', 50 + Math.round(metadata.percent / 2));
  });
  
  // Get just the filename from the path
  const filename = pkgPath.split('/').pop() || pkgPath;
  
  return { filename, data };
}
