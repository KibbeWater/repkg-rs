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
  const blob = new Blob([data], { type: mimeType });
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
