import * as fs from 'fs/promises';
import * as path from 'path';

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export async function cleanDir(dirPath: string): Promise<void> {
  try {
    const files = await fs.readdir(dirPath);
    await Promise.all(
      files.map((file: string) => fs.unlink(path.join(dirPath, file)))
    );
  } catch (error) {
    // Directory might not exist, that's okay
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function generateOutputFilename(url: string, extension: string = 'json'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const urlHash = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  return `transcript_${urlHash}_${timestamp}.${extension}`;
}