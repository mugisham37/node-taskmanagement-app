export interface ICacheSerializer {
  serialize<T>(value: T): string;
  deserialize<T>(value: string): T;
}

export class JsonSerializer implements ICacheSerializer {
  serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  deserialize<T>(value: string): T {
    return JSON.parse(value) as T;
  }
}

export class CompressedJsonSerializer implements ICacheSerializer {
  serialize<T>(value: T): string {
    const json = JSON.stringify(value);
    // In a real implementation, you would use a compression library like zlib
    return json;
  }

  deserialize<T>(value: string): T {
    // In a real implementation, you would decompress first
    return JSON.parse(value) as T;
  }
}

export class BinarySerializer implements ICacheSerializer {
  serialize<T>(value: T): string {
    // Convert to binary format (simplified implementation)
    const json = JSON.stringify(value);
    return Buffer.from(json).toString('base64');
  }

  deserialize<T>(value: string): T {
    const json = Buffer.from(value, 'base64').toString('utf-8');
    return JSON.parse(json) as T;
  }
}