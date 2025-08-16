import { gunzipSync, gzipSync } from 'zlib';

export interface CompressionProvider {
  compress(data: string): Buffer;
  decompress(data: Buffer): string;
  getCompressionRatio(original: string, compressed: Buffer): number;
}

export class GzipCompressionProvider implements CompressionProvider {
  compress(data: string): Buffer {
    return gzipSync(Buffer.from(data, 'utf-8'));
  }

  decompress(data: Buffer): string {
    return gunzipSync(data).toString('utf-8');
  }

  getCompressionRatio(original: string, compressed: Buffer): number {
    const originalSize = Buffer.byteLength(original, 'utf-8');
    const compressedSize = compressed.length;
    return compressedSize / originalSize;
  }
}

export class LZ4CompressionProvider implements CompressionProvider {
  compress(data: string): Buffer {
    // Simplified implementation - in production, use a proper LZ4 library
    return Buffer.from(data, 'utf-8');
  }

  decompress(data: Buffer): string {
    return data.toString('utf-8');
  }

  getCompressionRatio(original: string, compressed: Buffer): number {
    const originalSize = Buffer.byteLength(original, 'utf-8');
    const compressedSize = compressed.length;
    return compressedSize / originalSize;
  }
}

export class CompressionManager {
  private providers: Map<string, CompressionProvider> = new Map();
  private compressionThreshold: number;

  constructor(compressionThreshold: number = 1024) { // 1KB threshold
    this.compressionThreshold = compressionThreshold;
    this.providers.set('gzip', new GzipCompressionProvider());
    this.providers.set('lz4', new LZ4CompressionProvider());
  }

  shouldCompress(data: string): boolean {
    return Buffer.byteLength(data, 'utf-8') > this.compressionThreshold;
  }

  compress(data: string, algorithm: string = 'gzip'): { compressed: Buffer; algorithm: string } | null {
    if (!this.shouldCompress(data)) {
      return null;
    }

    const provider = this.providers.get(algorithm);
    if (!provider) {
      throw new Error(`Unknown compression algorithm: ${algorithm}`);
    }

    const compressed = provider.compress(data);
    const ratio = provider.getCompressionRatio(data, compressed);

    // Only return compressed data if it's actually smaller
    if (ratio < 0.9) { // 10% compression minimum
      return { compressed, algorithm };
    }

    return null;
  }

  decompress(data: Buffer, algorithm: string): string {
    const provider = this.providers.get(algorithm);
    if (!provider) {
      throw new Error(`Unknown compression algorithm: ${algorithm}`);
    }

    return provider.decompress(data);
  }

  registerProvider(name: string, provider: CompressionProvider): void {
    this.providers.set(name, provider);
  }

  getAvailableAlgorithms(): string[] {
    return Array.from(this.providers.keys());
  }
}