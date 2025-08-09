import { Request, Response, NextFunction } from 'express';
import * as zlib from 'zlib';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';

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
      const originalWrite = res.write;
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

      res.end = async function (chunk?: any, encoding?: any) {
        if (hasEnded) return res;
        hasEnded = true;

        if (chunk) {
          chunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding)
          );
        }

        const responseBody = Buffer.concat(chunks);
        const shouldCompress = await this.shouldCompress(res, responseBody);

        if (shouldCompress) {
          try {
            const startTime = Date.now();
            const compressed = await this.compressData(
              responseBody,
              supportedAlgorithm
            );
            const compressionTime = Date.now() - startTime;

            // Update stats
            this.stats.compressedRequests++;
            this.stats.totalBytesSaved +=
              responseBody.length - compressed.length;
            this.stats.averageCompressionTime =
              (this.stats.averageCompressionTime *
                (this.stats.compressedRequests - 1) +
                compressionTime) /
              this.stats.compressedRequests;
            this.stats.compressionRatio =
              this.stats.totalBytesSaved / (this.stats.totalRequests * 1000); // KB saved per request

            // Set compression headers
            res.setHeader('Content-Encoding', supportedAlgorithm);
            res.setHeader('Content-Length', compressed.length);
            res.setHeader('Vary', 'Accept-Encoding');

            return originalEnd.call(res, compressed);
          } catch (error) {
            console.error('Compression error:', error);
            return originalEnd.call(res, responseBody);
          }
        } else {
          return originalEnd.call(res, responseBody);
        }
      }.bind(this);

      next();
    };
  }

  /**
   * Compress data using specified algorithm
   */
  private async compressData(data: Buffer, algorithm: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const options = {
        level: this.config.level,
        chunkSize: this.config.chunkSize,
      };

      switch (algorithm) {
        case 'gzip':
          zlib.gzip(data, options, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
          break;
        case 'deflate':
          zlib.deflate(data, options, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
          break;
        case 'br':
          zlib.brotliCompress(
            data,
            {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: this.config.level,
              },
            },
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
          break;
        default:
          reject(new Error(`Unsupported compression algorithm: ${algorithm}`));
      }
    });
  }

  /**
   * Determine if response should be compressed
   */
  private async shouldCompress(res: Response, data: Buffer): Promise<boolean> {
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
