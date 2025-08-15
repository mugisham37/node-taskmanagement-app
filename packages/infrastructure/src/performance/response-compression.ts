import * as zlib from 'zlib';
import { CompressionAlgorithm, ResponseCompressionService } from './interfaces';

export interface CompressionConfig {
  enabled: boolean;
  threshold: number; // Minimum response size to compress (bytes)
  level: number; // Compression level (1-9)
  algorithms: CompressionAlgorithm[];
  excludeContentTypes: string[];
  includeContentTypes: string[];
  chunkSize: number;
}

export interface CompressionStats {
  totalRequests: number;
  compressedRequests: number;
  compressionRatio: number;
  averageCompressionTime: number;
  totalBytesSaved: number;
}

export class DefaultResponseCompressionService implements ResponseCompressionService {
  private stats: CompressionStats = {
    totalRequests: 0,
    compressedRequests: 0,
    compressionRatio: 0,
    averageCompressionTime: 0,
    totalBytesSaved: 0,
  };

  constructor(private readonly config: CompressionConfig) {}

  /**
   * Compress response data
   */
  async compress(data: any, algorithm: CompressionAlgorithm = 'gzip'): Promise<Buffer> {
    if (!this.config.enabled) {
      return Buffer.from(JSON.stringify(data));
    }

    const startTime = Date.now();
    const inputBuffer = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data));

    // Check if data meets compression threshold
    if (inputBuffer.length < this.config.threshold) {
      return inputBuffer;
    }

    let compressed: Buffer;

    try {
      switch (algorithm) {
        case 'gzip':
          compressed = await this.compressGzip(inputBuffer);
          break;
        case 'deflate':
          compressed = await this.compressDeflate(inputBuffer);
          break;
        case 'brotli':
          compressed = await this.compressBrotli(inputBuffer);
          break;
        default:
          compressed = inputBuffer;
      }

      // Update statistics
      const compressionTime = Date.now() - startTime;
      this.updateCompressionStats(inputBuffer.length, compressed.length, compressionTime);

      return compressed;
    } catch (error) {
      console.error('Compression error:', error);
      return inputBuffer;
    }
  }

  /**
   * Decompress response data
   */
  async decompress(data: Buffer, algorithm: CompressionAlgorithm = 'gzip'): Promise<any> {
    if (!this.config.enabled) {
      return JSON.parse(data.toString());
    }

    try {
      let decompressed: Buffer;

      switch (algorithm) {
        case 'gzip':
          decompressed = await this.decompressGzip(data);
          break;
        case 'deflate':
          decompressed = await this.decompressDeflate(data);
          break;
        case 'brotli':
          decompressed = await this.decompressBrotli(data);
          break;
        default:
          decompressed = data;
      }

      return JSON.parse(decompressed.toString());
    } catch (error) {
      console.error('Decompression error:', error);
      return JSON.parse(data.toString());
    }
  }

  /**
   * Get compression ratio for data
   */
  getCompressionRatio(originalSize: number, compressedSize: number): number {
    if (originalSize === 0) return 0;
    return ((originalSize - compressedSize) / originalSize) * 100;
  }

  /**
   * Compress data using gzip
   */
  private async compressGzip(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gzip(data, {
        level: this.config.level,
        chunkSize: this.config.chunkSize,
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Compress data using deflate
   */
  private async compressDeflate(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.deflate(data, {
        level: this.config.level,
        chunkSize: this.config.chunkSize,
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Compress data using brotli
   */
  private async compressBrotli(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.brotliCompress(data, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: this.config.level,
        },
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Decompress gzip data
   */
  private async decompressGzip(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Decompress deflate data
   */
  private async decompressDeflate(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.inflate(data, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Decompress brotli data
   */
  private async decompressBrotli(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.brotliDecompress(data, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Update compression statistics
   */
  private updateCompressionStats(originalSize: number, compressedSize: number, compressionTime: number): void {
    this.stats.totalRequests++;
    this.stats.compressedRequests++;
    this.stats.totalBytesSaved += originalSize - compressedSize;

    this.stats.averageCompressionTime =
      (this.stats.averageCompressionTime * (this.stats.compressedRequests - 1) +
        compressionTime) / this.stats.compressedRequests;

    this.stats.compressionRatio = this.stats.totalRequests > 0
      ? (this.stats.totalBytesSaved / (this.stats.totalRequests * 1000)) * 100
      : 0;
  }

  /**
   * Get compression statistics
   */
  getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Reset compression statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      compressedRequests: 0,
      compressionRatio: 0,
      averageCompressionTime: 0,
      totalBytesSaved: 0,
    };
  }

  /**
   * Check if content type should be compressed
   */
  shouldCompress(contentType: string, dataSize: number): boolean {
    if (!this.config.enabled || dataSize < this.config.threshold) {
      return false;
    }

    // If include list is specified, only compress those types
    if (this.config.includeContentTypes.length > 0) {
      return this.config.includeContentTypes.some(type =>
        contentType.toLowerCase().includes(type.toLowerCase())
      );
    }

    // Otherwise, exclude specified types
    return !this.config.excludeContentTypes.some(type =>
      contentType.toLowerCase().includes(type.toLowerCase())
    );
  }
}

/**
 * Create default response compression service
 */
export function createResponseCompressionService(
  config?: Partial<CompressionConfig>
): DefaultResponseCompressionService {
  const defaultConfig: CompressionConfig = {
    enabled: true,
    threshold: 1024, // 1KB
    level: 6, // Balanced compression level
    algorithms: ['brotli', 'gzip', 'deflate'],
    excludeContentTypes: [
      'image/',
      'video/',
      'audio/',
      'application/zip',
      'application/gzip',
      'application/x-rar',
      'application/pdf',
    ],
    includeContentTypes: [],
    chunkSize: 16 * 1024, // 16KB
    ...config,
  };

  return new DefaultResponseCompressionService(defaultConfig);
}