import { FastifyReply, FastifyRequest } from 'fastify';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { constants, createBrotliCompress, createGzip } from 'zlib';

const pipelineAsync = promisify(pipeline);

export interface CompressionOptions {
  threshold?: number;           // Minimum response size to compress (bytes)
  level?: number;              // Compression level (1-9)
  chunkSize?: number;          // Chunk size for streaming
  windowBits?: number;         // Window size for gzip
  memLevel?: number;           // Memory level for gzip
  strategy?: number;           // Compression strategy
  brotliQuality?: number;      // Brotli quality (0-11)
  enableBrotli?: boolean;      // Enable Brotli compression
  mimeTypes?: string[];        // MIME types to compress
}

const DEFAULT_MIME_TYPES = [
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/json',
  'application/xml',
  'text/xml',
  'application/rss+xml',
  'application/atom+xml',
  'image/svg+xml',
];

export class CompressionMiddleware {
  private options: Required<CompressionOptions>;

  constructor(options: CompressionOptions = {}) {
    this.options = {
      threshold: options.threshold || 1024,
      level: options.level || 6,
      chunkSize: options.chunkSize || 16384,
      windowBits: options.windowBits || 15,
      memLevel: options.memLevel || 8,
      strategy: options.strategy || constants.Z_DEFAULT_STRATEGY,
      brotliQuality: options.brotliQuality || 6,
      enableBrotli: options.enableBrotli !== false,
      mimeTypes: options.mimeTypes || DEFAULT_MIME_TYPES,
    };
  }

  middleware() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip compression for certain conditions
      if (this.shouldSkipCompression(request, reply)) {
        return;
      }

      const acceptEncoding = request.headers['accept-encoding'] || '';
      let compressionType: 'br' | 'gzip' | 'deflate' | null = null;

      // Determine best compression method
      if (this.options.enableBrotli && acceptEncoding.includes('br')) {
        compressionType = 'br';
      } else if (acceptEncoding.includes('gzip')) {
        compressionType = 'gzip';
      } else if (acceptEncoding.includes('deflate')) {
        compressionType = 'deflate';
      }

      if (!compressionType) {
        return;
      }

      // Hook into the response to compress data
      reply.hijack();
      
      const originalSend = reply.send.bind(reply);
      reply.send = async (payload: any) => {
        try {
          const data = this.serializePayload(payload);
          
          if (data.length < this.options.threshold) {
            // Don't compress small responses
            reply.header('content-length', data.length);
            reply.raw.end(data);
            return reply;
          }

          if (!this.shouldCompressMimeType(reply.getHeader('content-type') as string)) {
            reply.header('content-length', data.length);
            reply.raw.end(data);
            return reply;
          }

          const compressedData = await this.compressData(data, compressionType);
          
          reply.header('content-encoding', compressionType);
          reply.header('content-length', compressedData.length);
          reply.removeHeader('content-length'); // Let the server calculate
          
          reply.raw.end(compressedData);
          return reply;
        } catch (error) {
          // Fallback to uncompressed response
          const data = this.serializePayload(payload);
          reply.header('content-length', data.length);
          reply.raw.end(data);
          return reply;
        }
      };
    };
  }

  private shouldSkipCompression(request: FastifyRequest, reply: FastifyReply): boolean {
    // Skip if already compressed
    if (reply.getHeader('content-encoding')) {
      return true;
    }

    // Skip for certain request methods
    if (['HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // Skip if client doesn't support compression
    const acceptEncoding = request.headers['accept-encoding'];
    if (!acceptEncoding) {
      return true;
    }

    // Skip for certain response codes
    const statusCode = reply.statusCode;
    if (statusCode < 200 || statusCode === 204 || statusCode === 304) {
      return true;
    }

    return false;
  }

  private shouldCompressMimeType(contentType: string): boolean {
    if (!contentType) {
      return false;
    }

    const mimeType = contentType.split(';')[0].trim().toLowerCase();
    return this.options.mimeTypes.includes(mimeType);
  }

  private serializePayload(payload: any): Buffer {
    if (Buffer.isBuffer(payload)) {
      return payload;
    }

    if (typeof payload === 'string') {
      return Buffer.from(payload, 'utf8');
    }

    if (typeof payload === 'object') {
      return Buffer.from(JSON.stringify(payload), 'utf8');
    }

    return Buffer.from(String(payload), 'utf8');
  }

  private async compressData(data: Buffer, type: 'br' | 'gzip' | 'deflate'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let compressor;

      switch (type) {
        case 'br':
          compressor = createBrotliCompress({
            params: {
              [constants.BROTLI_PARAM_QUALITY]: this.options.brotliQuality,
              [constants.BROTLI_PARAM_SIZE_HINT]: data.length,
            },
          });
          break;
        
        case 'gzip':
          compressor = createGzip({
            level: this.options.level,
            chunkSize: this.options.chunkSize,
            windowBits: this.options.windowBits,
            memLevel: this.options.memLevel,
            strategy: this.options.strategy,
          });
          break;
        
        case 'deflate':
          compressor = createGzip({
            level: this.options.level,
            chunkSize: this.options.chunkSize,
            windowBits: -this.options.windowBits, // Negative for deflate
            memLevel: this.options.memLevel,
            strategy: this.options.strategy,
          });
          break;
        
        default:
          return reject(new Error(`Unsupported compression type: ${type}`));
      }

      compressor.on('data', (chunk) => {
        chunks.push(chunk);
      });

      compressor.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      compressor.on('error', reject);

      compressor.end(data);
    });
  }

  // Streaming compression for large responses
  async compressStream(
    inputStream: NodeJS.ReadableStream,
    outputStream: NodeJS.WritableStream,
    type: 'br' | 'gzip' | 'deflate'
  ): Promise<void> {
    let compressor;

    switch (type) {
      case 'br':
        compressor = createBrotliCompress({
          params: {
            [constants.BROTLI_PARAM_QUALITY]: this.options.brotliQuality,
          },
        });
        break;
      
      case 'gzip':
        compressor = createGzip({
          level: this.options.level,
          chunkSize: this.options.chunkSize,
        });
        break;
      
      case 'deflate':
        compressor = createGzip({
          level: this.options.level,
          chunkSize: this.options.chunkSize,
          windowBits: -this.options.windowBits,
        });
        break;
      
      default:
        throw new Error(`Unsupported compression type: ${type}`);
    }

    await pipelineAsync(inputStream, compressor, outputStream);
  }
}