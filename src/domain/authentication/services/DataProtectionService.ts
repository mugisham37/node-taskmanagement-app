import crypto from 'crypto';
import { UserId } from '../value-objects/UserId';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  keyDerivationIterations: number;
}

export interface EncryptedData {
  data: string;
  iv: string;
  tag: string;
  algorithm: string;
  keyId: string;
}

export interface KeyMetadata {
  id: string;
  algorithm: string;
  purpose: string;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  rotationCount: number;
}

export interface DataClassification {
  level: 'public' | 'internal' | 'confidential' | 'restricted';
  categories: string[];
  retentionPeriod?: number;
  encryptionRequired: boolean;
  accessLoggingRequired: boolean;
}

export interface PIIField {
  fieldName: string;
  dataType:
    | 'email'
    | 'phone'
    | 'ssn'
    | 'credit_card'
    | 'name'
    | 'address'
    | 'custom';
  maskingPattern?: string;
  encryptionRequired: boolean;
}

export interface DataMaskingOptions {
  maskingChar: string;
  preserveLength: boolean;
  preserveFormat: boolean;
  showFirst?: number;
  showLast?: number;
}

export class DataEncryptedEvent extends DomainEvent {
  constructor(
    public readonly dataType: string,
    public readonly keyId: string,
    public readonly userId?: UserId
  ) {
    super('DataEncrypted', {
      dataType,
      keyId,
      userId: userId?.value,
    });
  }
}

export class DataDecryptedEvent extends DomainEvent {
  constructor(
    public readonly dataType: string,
    public readonly keyId: string,
    public readonly userId?: UserId
  ) {
    super('DataDecrypted', {
      dataType,
      keyId,
      userId: userId?.value,
    });
  }
}

export class KeyRotatedEvent extends DomainEvent {
  constructor(
    public readonly oldKeyId: string,
    public readonly newKeyId: string,
    public readonly purpose: string
  ) {
    super('KeyRotated', {
      oldKeyId,
      newKeyId,
      purpose,
    });
  }
}

export class PIIAccessedEvent extends DomainEvent {
  constructor(
    public readonly dataType: string,
    public readonly userId: UserId,
    public readonly accessType: 'read' | 'write' | 'export',
    public readonly context: Record<string, any>
  ) {
    super('PIIAccessed', {
      dataType,
      userId: userId.value,
      accessType,
      context,
    });
  }
}

/**
 * Comprehensive Data Protection Service
 * Handles encryption, key management, data masking, and PII protection
 */
export class DataProtectionService {
  private readonly encryptionConfig: EncryptionConfig;
  private readonly activeKeys: Map<string, Buffer> = new Map();
  private readonly dataClassifications: Map<string, DataClassification> =
    new Map();
  private readonly piiFields: Map<string, PIIField> = new Map();

  constructor(
    private readonly keyManagementRepository: any,
    private readonly encryptionRepository: any,
    private readonly auditService: any,
    private readonly eventBus: any,
    config: {
      encryptionConfig: EncryptionConfig;
      masterKey: string;
    }
  ) {
    this.encryptionConfig = config.encryptionConfig;
    this.initializeDataClassifications();
    this.initializePIIFields();
  }

  /**
   * Encrypt sensitive data
   */
  async encryptData(
    data: string,
    dataType: string,
    userId?: UserId,
    keyId?: string
  ): Promise<EncryptedData> {
    try {
      // Get or create encryption key
      const activeKeyId = keyId || (await this.getActiveKeyId(dataType));
      const encryptionKey = await this.getEncryptionKey(activeKeyId);

      // Generate random IV
      const iv = crypto.randomBytes(this.encryptionConfig.ivLength);

      // Create cipher
      const cipher = crypto.createCipher(
        this.encryptionConfig.algorithm,
        encryptionKey
      );
      cipher.setAAD(Buffer.from(dataType)); // Additional authenticated data

      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const tag = cipher.getAuthTag();

      const encryptedData: EncryptedData = {
        data: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.encryptionConfig.algorithm,
        keyId: activeKeyId,
      };

      // Store encrypted data metadata
      await this.encryptionRepository.storeMetadata({
        keyId: activeKeyId,
        dataType,
        encryptedAt: new Date(),
        userId: userId?.value,
      });

      // Publish event
      await this.eventBus.publish(
        new DataEncryptedEvent(dataType, activeKeyId, userId)
      );

      // Audit log
      await this.auditService.logDataAccessEvent(
        'encrypt',
        userId || UserId.create('system'),
        'data_protection',
        activeKeyId,
        {
          dataType,
          algorithm: this.encryptionConfig.algorithm,
        }
      );

      return encryptedData;
    } catch (error) {
      throw new Error(`Data encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decryptData(
    encryptedData: EncryptedData,
    dataType: string,
    userId?: UserId
  ): Promise<string> {
    try {
      // Get decryption key
      const decryptionKey = await this.getEncryptionKey(encryptedData.keyId);

      // Create decipher
      const decipher = crypto.createDecipher(
        encryptedData.algorithm,
        decryptionKey
      );
      decipher.setAAD(Buffer.from(dataType));
      decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

      // Decrypt data
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Publish event
      await this.eventBus.publish(
        new DataDecryptedEvent(dataType, encryptedData.keyId, userId)
      );

      // Audit log
      await this.auditService.logDataAccessEvent(
        'decrypt',
        userId || UserId.create('system'),
        'data_protection',
        encryptedData.keyId,
        {
          dataType,
          algorithm: encryptedData.algorithm,
        }
      );

      return decrypted;
    } catch (error) {
      throw new Error(`Data decryption failed: ${error.message}`);
    }
  }

  /**
   * Hash sensitive data (one-way)
   */
  async hashData(
    data: string,
    salt?: string,
    iterations?: number
  ): Promise<{ hash: string; salt: string }> {
    try {
      const actualSalt = salt || crypto.randomBytes(32).toString('hex');
      const actualIterations =
        iterations || this.encryptionConfig.keyDerivationIterations;

      const hash = crypto
        .pbkdf2Sync(data, actualSalt, actualIterations, 64, 'sha512')
        .toString('hex');

      return {
        hash,
        salt: actualSalt,
      };
    } catch (error) {
      throw new Error(`Data hashing failed: ${error.message}`);
    }
  }

  /**
   * Verify hashed data
   */
  async verifyHash(
    data: string,
    hash: string,
    salt: string,
    iterations?: number
  ): Promise<boolean> {
    try {
      const actualIterations =
        iterations || this.encryptionConfig.keyDerivationIterations;

      const computedHash = crypto
        .pbkdf2Sync(data, salt, actualIterations, 64, 'sha512')
        .toString('hex');

      return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(computedHash, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Mask PII data for display
   */
  maskPIIData(
    data: string,
    fieldType: string,
    options: DataMaskingOptions = {
      maskingChar: '*',
      preserveLength: true,
      preserveFormat: false,
    }
  ): string {
    try {
      const piiField = this.piiFields.get(fieldType);
      if (!piiField) {
        return data; // No masking rule defined
      }

      switch (piiField.dataType) {
        case 'email':
          return this.maskEmail(data, options);
        case 'phone':
          return this.maskPhone(data, options);
        case 'ssn':
          return this.maskSSN(data, options);
        case 'credit_card':
          return this.maskCreditCard(data, options);
        case 'name':
          return this.maskName(data, options);
        case 'address':
          return this.maskAddress(data, options);
        default:
          return this.maskGeneric(data, options);
      }
    } catch (error) {
      console.error('PII masking failed:', error);
      return data; // Return original data if masking fails
    }
  }

  /**
   * Generate encryption key
   */
  async generateEncryptionKey(
    purpose: string,
    algorithm?: string
  ): Promise<KeyMetadata> {
    try {
      const keyId = crypto.randomUUID();
      const key = crypto.randomBytes(this.encryptionConfig.keyLength);

      const keyMetadata: KeyMetadata = {
        id: keyId,
        algorithm: algorithm || this.encryptionConfig.algorithm,
        purpose,
        createdAt: new Date(),
        isActive: true,
        rotationCount: 0,
      };

      // Store key securely
      await this.keyManagementRepository.storeKey(keyId, key, keyMetadata);

      // Cache key
      this.activeKeys.set(keyId, key);

      return keyMetadata;
    } catch (error) {
      throw new Error(`Key generation failed: ${error.message}`);
    }
  }

  /**
   * Rotate encryption key
   */
  async rotateEncryptionKey(
    oldKeyId: string,
    purpose: string
  ): Promise<KeyMetadata> {
    try {
      // Get old key metadata
      const oldKeyMetadata =
        await this.keyManagementRepository.getKeyMetadata(oldKeyId);
      if (!oldKeyMetadata) {
        throw new Error('Old key not found');
      }

      // Generate new key
      const newKeyMetadata = await this.generateEncryptionKey(
        purpose,
        oldKeyMetadata.algorithm
      );
      newKeyMetadata.rotationCount = oldKeyMetadata.rotationCount + 1;

      // Deactivate old key
      oldKeyMetadata.isActive = false;
      await this.keyManagementRepository.updateKeyMetadata(
        oldKeyId,
        oldKeyMetadata
      );

      // Remove old key from cache
      this.activeKeys.delete(oldKeyId);

      // Publish event
      await this.eventBus.publish(
        new KeyRotatedEvent(oldKeyId, newKeyMetadata.id, purpose)
      );

      return newKeyMetadata;
    } catch (error) {
      throw new Error(`Key rotation failed: ${error.message}`);
    }
  }

  /**
   * Encrypt object fields based on classification
   */
  async encryptObjectFields(
    obj: Record<string, any>,
    objectType: string,
    userId?: UserId
  ): Promise<Record<string, any>> {
    const result = { ...obj };
    const classification = this.dataClassifications.get(objectType);

    if (!classification || !classification.encryptionRequired) {
      return result;
    }

    for (const [fieldName, value] of Object.entries(obj)) {
      const piiField = this.piiFields.get(fieldName);

      if (piiField && piiField.encryptionRequired && value) {
        const encryptedData = await this.encryptData(
          String(value),
          `${objectType}.${fieldName}`,
          userId
        );
        result[fieldName] = encryptedData;
      }
    }

    return result;
  }

  /**
   * Decrypt object fields
   */
  async decryptObjectFields(
    obj: Record<string, any>,
    objectType: string,
    userId?: UserId
  ): Promise<Record<string, any>> {
    const result = { ...obj };

    for (const [fieldName, value] of Object.entries(obj)) {
      if (this.isEncryptedData(value)) {
        try {
          const decryptedValue = await this.decryptData(
            value as EncryptedData,
            `${objectType}.${fieldName}`,
            userId
          );
          result[fieldName] = decryptedValue;
        } catch (error) {
          console.error(`Failed to decrypt field ${fieldName}:`, error);
          // Keep encrypted data if decryption fails
        }
      }
    }

    return result;
  }

  /**
   * Mask object fields for display
   */
  maskObjectFields(
    obj: Record<string, any>,
    objectType: string,
    userId?: UserId
  ): Record<string, any> {
    const result = { ...obj };

    for (const [fieldName, value] of Object.entries(obj)) {
      const piiField = this.piiFields.get(fieldName);

      if (piiField && value && typeof value === 'string') {
        result[fieldName] = this.maskPIIData(value, fieldName);

        // Log PII access
        if (userId) {
          this.eventBus.publish(
            new PIIAccessedEvent(`${objectType}.${fieldName}`, userId, 'read', {
              maskedAccess: true,
            })
          );
        }
      }
    }

    return result;
  }

  /**
   * Check if data requires encryption
   */
  requiresEncryption(dataType: string, fieldName?: string): boolean {
    const classification = this.dataClassifications.get(dataType);
    if (classification && classification.encryptionRequired) {
      return true;
    }

    if (fieldName) {
      const piiField = this.piiFields.get(fieldName);
      return piiField ? piiField.encryptionRequired : false;
    }

    return false;
  }

  /**
   * Get data classification
   */
  getDataClassification(dataType: string): DataClassification | undefined {
    return this.dataClassifications.get(dataType);
  }

  /**
   * Clean up expired keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    try {
      const expiredKeys = await this.keyManagementRepository.getExpiredKeys();
      let cleanedCount = 0;

      for (const keyMetadata of expiredKeys) {
        // Ensure key is not active and has been rotated
        if (!keyMetadata.isActive && keyMetadata.rotationCount > 0) {
          await this.keyManagementRepository.deleteKey(keyMetadata.id);
          this.activeKeys.delete(keyMetadata.id);
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('Key cleanup failed:', error);
      return 0;
    }
  }

  // Private helper methods

  private async getActiveKeyId(dataType: string): Promise<string> {
    const activeKey = await this.keyManagementRepository.getActiveKey(dataType);

    if (!activeKey) {
      // Generate new key if none exists
      const keyMetadata = await this.generateEncryptionKey(dataType);
      return keyMetadata.id;
    }

    return activeKey.id;
  }

  private async getEncryptionKey(keyId: string): Promise<Buffer> {
    // Check cache first
    if (this.activeKeys.has(keyId)) {
      return this.activeKeys.get(keyId)!;
    }

    // Load from repository
    const key = await this.keyManagementRepository.getKey(keyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }

    // Cache key
    this.activeKeys.set(keyId, key);
    return key;
  }

  private isEncryptedData(value: any): boolean {
    return (
      value &&
      typeof value === 'object' &&
      'data' in value &&
      'iv' in value &&
      'tag' in value &&
      'algorithm' in value &&
      'keyId' in value
    );
  }

  private maskEmail(email: string, options: DataMaskingOptions): string {
    const [localPart, domain] = email.split('@');
    if (!domain) return email;

    const maskedLocal = this.maskGeneric(localPart, {
      ...options,
      showFirst: 2,
      showLast: 0,
    });

    return `${maskedLocal}@${domain}`;
  }

  private maskPhone(phone: string, options: DataMaskingOptions): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return phone;

    const masked = this.maskGeneric(digits, {
      ...options,
      showFirst: 3,
      showLast: 4,
    });

    // Preserve original formatting
    return phone.replace(/\d/g, (match, index) => {
      const digitIndex = phone.substring(0, index).replace(/\D/g, '').length;
      return masked[digitIndex] || match;
    });
  }

  private maskSSN(ssn: string, options: DataMaskingOptions): string {
    const digits = ssn.replace(/\D/g, '');
    if (digits.length !== 9) return ssn;

    return `***-**-${digits.slice(-4)}`;
  }

  private maskCreditCard(
    cardNumber: string,
    options: DataMaskingOptions
  ): string {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 13) return cardNumber;

    const masked = '*'.repeat(digits.length - 4) + digits.slice(-4);

    // Preserve formatting
    return cardNumber.replace(/\d/g, (match, index) => {
      const digitIndex = cardNumber
        .substring(0, index)
        .replace(/\D/g, '').length;
      return masked[digitIndex] || match;
    });
  }

  private maskName(name: string, options: DataMaskingOptions): string {
    const parts = name.split(' ');
    return parts
      .map(part => this.maskGeneric(part, { ...options, showFirst: 1 }))
      .join(' ');
  }

  private maskAddress(address: string, options: DataMaskingOptions): string {
    // Simple address masking - mask everything except last word (likely city/state)
    const parts = address.split(' ');
    if (parts.length <= 1) return address;

    const maskedParts = parts
      .slice(0, -1)
      .map(part => this.maskGeneric(part, options));

    return [...maskedParts, parts[parts.length - 1]].join(' ');
  }

  private maskGeneric(data: string, options: DataMaskingOptions): string {
    if (!data) return data;

    const showFirst = options.showFirst || 0;
    const showLast = options.showLast || 0;
    const maskChar = options.maskingChar || '*';

    if (showFirst + showLast >= data.length) {
      return data;
    }

    const firstPart = data.substring(0, showFirst);
    const lastPart = showLast > 0 ? data.substring(data.length - showLast) : '';
    const middleLength = data.length - showFirst - showLast;
    const middlePart = maskChar.repeat(middleLength);

    return firstPart + middlePart + lastPart;
  }

  private initializeDataClassifications(): void {
    const classifications: Array<[string, DataClassification]> = [
      [
        'user',
        {
          level: 'confidential',
          categories: ['pii', 'authentication'],
          encryptionRequired: true,
          accessLoggingRequired: true,
        },
      ],
      [
        'payment',
        {
          level: 'restricted',
          categories: ['financial', 'pci'],
          encryptionRequired: true,
          accessLoggingRequired: true,
        },
      ],
      [
        'task',
        {
          level: 'internal',
          categories: ['business'],
          encryptionRequired: false,
          accessLoggingRequired: false,
        },
      ],
      [
        'project',
        {
          level: 'internal',
          categories: ['business'],
          encryptionRequired: false,
          accessLoggingRequired: false,
        },
      ],
      [
        'workspace',
        {
          level: 'confidential',
          categories: ['business', 'configuration'],
          encryptionRequired: true,
          accessLoggingRequired: true,
        },
      ],
    ];

    classifications.forEach(([key, classification]) => {
      this.dataClassifications.set(key, classification);
    });
  }

  private initializePIIFields(): void {
    const piiFields: Array<[string, PIIField]> = [
      [
        'email',
        {
          fieldName: 'email',
          dataType: 'email',
          encryptionRequired: true,
        },
      ],
      [
        'phone',
        {
          fieldName: 'phone',
          dataType: 'phone',
          encryptionRequired: true,
        },
      ],
      [
        'firstName',
        {
          fieldName: 'firstName',
          dataType: 'name',
          encryptionRequired: true,
        },
      ],
      [
        'lastName',
        {
          fieldName: 'lastName',
          dataType: 'name',
          encryptionRequired: true,
        },
      ],
      [
        'address',
        {
          fieldName: 'address',
          dataType: 'address',
          encryptionRequired: true,
        },
      ],
      [
        'ssn',
        {
          fieldName: 'ssn',
          dataType: 'ssn',
          encryptionRequired: true,
        },
      ],
      [
        'creditCard',
        {
          fieldName: 'creditCard',
          dataType: 'credit_card',
          encryptionRequired: true,
        },
      ],
    ];

    piiFields.forEach(([key, field]) => {
      this.piiFields.set(key, field);
    });
  }
}
