import { Request, Response, NextFunction } from 'express';
import * as zlib from 'zlib';

export interface CompressionConfig {
  enabled: boolean;
  threshold: number; // Minimum response size to compress (bytes)
  level: number; // Compression level (1-9)
  algorithms: ('gzip' | 'deflate' | 'br')[];
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

export class ResponseCompressionService {
  private stats: CompressionStats = {
    totalRequests: 0,
    compressedRequests: 0,
    compressionRatio: 0,
    averageCompressionTime: 0,
    totalBytesSaved: 0,
  };

  constructor(private readonly config: CompressionConfig) {}

  /**
   * Create compression middleware
   */
  createMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next();
      }

      this.stats.totalRequests++;

      // Check if client accepts compression
      const acceptEncoding = req.headers['accept-encoding'] || '';
      const supportedAlgorithm = this.getSupportedAlgorithm(acceptEncoding);

      if (!supportedAlgorithm) {
        return next();
      }

      // Override res.end to compress response
      const originalEnd = res.end;
      const chunks: Buffer[] = [];
      let hasEnded = false;

      res.write = function (chunk: any, encoding?: any) {
        if (hasEnded) return false;

        if (chunk) {
          chunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding)
          );
        }
        return true;
      };

      const self = this;
      res.end = function (chunk?: any, encoding?: any, cb?: () => void) {
        if (hasEnded) return res;
        hasEnded = true;

        if (chunk) {
          chunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding)
          );
        }

        const responseBody = Buffer.concat(chunks);

        // Process compression synchronously to avoid Promise issues
        const shouldCompress = self.shouldCompressSync(res, responseBody);

        if (shouldCompress) {
          try {
            const startTime = Date.now();
            
            // Use synchronous compression
            let compressed: Buffer;
            switch (supportedAlgorithm) {
              case 'gzip':
                compressed = zlib.gzipSync(responseBody, {
                  level: self.config.level,
                  chunkSize: self.config.chunkSize,
                });
                break;
              case 'deflate':
                compressed = zlib.deflateSync(responseBody, {
                  level: self.config.level,
                  chunkSize: self.config.chunkSize,
                });
                break;
              case 'br':
                compressed = zlib.brotliCompressSync(responseBody, {
                  params: {
                    [zlib.constants.BROTLI_PARAM_QUALITY]: self.config.level,
                  },
                });
                break;
              default:
                compressed = responseBody;
            }
            
            const compressionTime = Date.now() - startTime;

            // Update stats
            self.stats.compressedRequests++;
            self.stats.totalBytesSaved += responseBody.length - compressed.length;
            self.stats.averageCompressionTime =
              (self.stats.averageCompressionTime * (self.stats.compressedRequests - 1) +
                compressionTime) / self.stats.compressedRequests;
            self.stats.compressionRatio =
              self.stats.totalBytesSaved / (self.stats.totalRequests * 1000);

            // Set compression headers
            res.setHeader('Content-Encoding', supportedAlgorithm);
            res.setHeader('Content-Length', compressed.length);
            res.setHeader('Vary', 'Accept-Encoding');

            return originalEnd.call(res, compressed, encoding, cb);
          } catch (error) {
            console.error('Compression error:', error);
            return originalEnd.call(res, responseBody, encoding, cb);
          }
        } else {
          return originalEnd.call(res, responseBody, encoding, cb);
        }
      };

      next();
    };
  }

  /**
   * Determine if response should be compressed (synchronous version)
   */
  private shouldCompressSync(res: Response, data: Buffer): boolean {
    // Check minimum size threshold
    if (data.length < this.config.threshold) {
      return false;
    }

    // Check if already compressed
    if (res.getHeader('Content-Encoding')) {
      return false;
    }

    // Check content type
    const contentType = (res.getHeader('Content-Type') as string) || '';

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

  /**
   * Get supported compression algorithm from Accept-Encoding header
   */
  private getSupportedAlgorithm(acceptEncoding: string): string | null {
    const encodings = acceptEncoding
      .toLowerCase()
      .split(',')
      .map(e => e.trim());

    for (const algorithm of this.config.algorithms) {
      if (encodings.includes(algorithm)) {
        return algorithm;
      }
    }

    return null;
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
}

/**
 * Create default compression service
 */
export function createCompressionService(
  config?: Partial<CompressionConfig>
): ResponseCompressionService {
  const defaultConfig: CompressionConfig = {
    enabled: true,
    threshold: 1024, // 1KB
    level: 6, // Balanced compression level
    algorithms: ['br', 'gzip', 'deflate'],
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

  return new ResponseCompressionService(defaultConfig);
}
