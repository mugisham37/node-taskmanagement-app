import { Device, DeviceType } from '../entities/device';

export interface IDeviceRepository {
  save(device: Device): Promise<void>;
  findById(id: string): Promise<Device | null>;
  findByUserId(userId: string): Promise<Device[]>;
  findByFingerprint(fingerprint: string): Promise<Device | null>;
  findTrusted(userId: string): Promise<Device[]>;
  findUntrusted(userId: string): Promise<Device[]>;
  findByType(
    type: DeviceType,
    limit?: number,
    offset?: number
  ): Promise<Device[]>;
  findInactive(thresholdDays: number): Promise<Device[]>;
  findHighRisk(): Promise<Device[]>;
  getDeviceStats(userId?: string): Promise<{
    totalDevices: number;
    trustedDevices: number;
    activeDevices: number;
    byType: Record<DeviceType, number>;
    averageRiskScore: number;
    recentActivity: number;
  }>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  deleteInactive(thresholdDays: number): Promise<number>;
}
