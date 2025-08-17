import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import { AppState, AppStateStatus, InteractionManager } from 'react-native';

export interface PerformanceMetrics {
  appStartTime: number;
  screenLoadTimes: Record<string, number>;
  apiResponseTimes: Record<string, number[]>;
  memoryUsage: MemoryInfo[];
  batteryLevel: number;
  networkType: string;
  deviceInfo: DeviceInfo;
  crashCount: number;
  errorCount: number;
}

export interface MemoryInfo {
  timestamp: number;
  jsHeapSizeUsed: number;
  jsHeapSizeTotal: number;
  jsHeapSizeLimit: number;
}

export interface DeviceInfo {
  brand: string;
  modelName: string;
  osName: string;
  osVersion: string;
  totalMemory: number;
  isDevice: boolean;
}

export interface PerformanceConfig {
  enableMetrics: boolean;
  enableBatteryOptimization: boolean;
  enableMemoryOptimization: boolean;
  enableNetworkOptimization: boolean;
  maxMetricsHistory: number;
  reportingInterval: number;
}

class PerformanceService {
  private static readonly METRICS_KEY = 'performance_metrics';
  private static readonly CONFIG_KEY = 'performance_config';
  
  private metrics: PerformanceMetrics;
  private config: PerformanceConfig;
  private isInitialized = false;
  private performanceObserver: PerformanceObserver | null = null;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private batteryCheckInterval: NodeJS.Timeout | null = null;
  private appStateListener: any = null;

  constructor() {
    this.metrics = this.getDefaultMetrics();
    this.config = this.getDefaultConfig();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load saved metrics and config
      await this.loadMetrics();
      await this.loadConfig();

      // Initialize device info
      await this.initializeDeviceInfo();

      // Set up monitoring
      this.setupPerformanceMonitoring();
      this.setupMemoryMonitoring();
      this.setupBatteryMonitoring();
      this.setupAppStateMonitoring();

      // Record app start time
      this.metrics.appStartTime = Date.now();

      this.isInitialized = true;
      console.log('Performance service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize performance service:', error);
      throw error;
    }
  }

  private getDefaultMetrics(): PerformanceMetrics {
    return {
      appStartTime: 0,
      screenLoadTimes: {},
      apiResponseTimes: {},
      memoryUsage: [],
      batteryLevel: 100,
      networkType: 'unknown',
      deviceInfo: {
        brand: '',
        modelName: '',
        osName: '',
        osVersion: '',
        totalMemory: 0,
        isDevice: false,
      },
      crashCount: 0,
      errorCount: 0,
    };
  }

  private getDefaultConfig(): PerformanceConfig {
    return {
      enableMetrics: true,
      enableBatteryOptimization: true,
      enableMemoryOptimization: true,
      enableNetworkOptimization: true,
      maxMetricsHistory: 100,
      reportingInterval: 60000, // 1 minute
    };
  }

  private async initializeDeviceInfo(): Promise<void> {
    try {
      this.metrics.deviceInfo = {
        brand: Device.brand || 'Unknown',
        modelName: Device.modelName || 'Unknown',
        osName: Device.osName || 'Unknown',
        osVersion: Device.osVersion || 'Unknown',
        totalMemory: Device.totalMemory || 0,
        isDevice: Device.isDevice,
      };
    } catch (error) {
      console.error('Failed to initialize device info:', error);
    }
  }

  private setupPerformanceMonitoring(): void {
    if (!this.config.enableMetrics) return;

    // Set up performance observer for navigation timing
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            this.recordNavigationTiming(entry);
          } else if (entry.entryType === 'measure') {
            this.recordCustomMeasure(entry);
          }
        });
      });

      this.performanceObserver.observe({ 
        entryTypes: ['navigation', 'measure'] 
      });
    }
  }

  private setupMemoryMonitoring(): void {
    if (!this.config.enableMemoryOptimization) return;

    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.config.reportingInterval);
  }

  private setupBatteryMonitoring(): void {
    if (!this.config.enableBatteryOptimization) return;

    this.batteryCheckInterval = setInterval(async () => {
      try {
        const batteryLevel = await Battery.getBatteryLevelAsync();
        this.metrics.batteryLevel = batteryLevel * 100;
        
        // Adjust performance based on battery level
        if (batteryLevel < 0.2) {
          await this.enableBatterySavingMode();
        } else if (batteryLevel > 0.8) {
          await this.disableBatterySavingMode();
        }
      } catch (error) {
        console.error('Failed to check battery level:', error);
      }
    }, this.config.reportingInterval);
  }

  private setupAppStateMonitoring(): void {
    this.appStateListener = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        this.onAppBackground();
      } else if (nextAppState === 'active') {
        this.onAppForeground();
      }
    });
  }

  private recordNavigationTiming(entry: PerformanceEntry): void {
    // Record navigation timing metrics
    console.log('Navigation timing:', entry);
  }

  private recordCustomMeasure(entry: PerformanceEntry): void {
    // Record custom performance measures
    console.log('Custom measure:', entry);
  }

  private async checkMemoryUsage(): Promise<void> {
    try {
      // Get memory usage information
      const memoryInfo: MemoryInfo = {
        timestamp: Date.now(),
        jsHeapSizeUsed: (performance as any).memory?.usedJSHeapSize || 0,
        jsHeapSizeTotal: (performance as any).memory?.totalJSHeapSize || 0,
        jsHeapSizeLimit: (performance as any).memory?.jsHeapSizeLimit || 0,
      };

      this.metrics.memoryUsage.push(memoryInfo);

      // Keep only recent memory usage data
      if (this.metrics.memoryUsage.length > this.config.maxMetricsHistory) {
        this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-this.config.maxMetricsHistory);
      }

      // Check for memory pressure
      const memoryPressure = this.calculateMemoryPressure(memoryInfo);
      if (memoryPressure > 0.8) {
        await this.handleMemoryPressure();
      }
    } catch (error) {
      console.error('Failed to check memory usage:', error);
    }
  }

  private calculateMemoryPressure(memoryInfo: MemoryInfo): number {
    if (memoryInfo.jsHeapSizeLimit === 0) return 0;
    return memoryInfo.jsHeapSizeUsed / memoryInfo.jsHeapSizeLimit;
  }

  private async handleMemoryPressure(): Promise<void> {
    console.log('Memory pressure detected, optimizing...');
    
    // Clear old cached data
    await this.clearOldCacheData();
    
    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Reduce image cache size
    await this.reduceImageCacheSize();
  }

  private async clearOldCacheData(): Promise<void> {
    try {
      // Clear old metrics data
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-50);
      
      // Clear old API response times
      Object.keys(this.metrics.apiResponseTimes).forEach(key => {
        this.metrics.apiResponseTimes[key] = this.metrics.apiResponseTimes[key].slice(-10);
      });
      
      await this.saveMetrics();
    } catch (error) {
      console.error('Failed to clear old cache data:', error);
    }
  }

  private async reduceImageCacheSize(): Promise<void> {
    // This would integrate with image caching libraries to reduce cache size
    console.log('Reducing image cache size...');
  }

  private async enableBatterySavingMode(): Promise<void> {
    console.log('Enabling battery saving mode...');
    
    // Reduce background sync frequency
    this.config.reportingInterval = 300000; // 5 minutes
    
    // Disable non-essential animations
    // This would be handled by the UI components
    
    // Reduce network requests
    // This would be handled by the API service
  }

  private async disableBatterySavingMode(): Promise<void> {
    console.log('Disabling battery saving mode...');
    
    // Restore normal sync frequency
    this.config.reportingInterval = 60000; // 1 minute
    
    // Re-enable animations and full functionality
  }

  private onAppBackground(): void {
    console.log('App moved to background');
    
    // Save current metrics
    this.saveMetrics();
    
    // Reduce background activity
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  private onAppForeground(): void {
    console.log('App moved to foreground');
    
    // Resume monitoring
    this.setupMemoryMonitoring();
    
    // Check network status
    this.checkNetworkStatus();
  }

  private async checkNetworkStatus(): Promise<void> {
    try {
      const netInfo = await NetInfo.fetch();
      this.metrics.networkType = netInfo.type;
      
      // Adjust behavior based on network type
      if (netInfo.type === 'cellular' && this.config.enableNetworkOptimization) {
        await this.enableDataSavingMode();
      } else {
        await this.disableDataSavingMode();
      }
    } catch (error) {
      console.error('Failed to check network status:', error);
    }
  }

  private async enableDataSavingMode(): Promise<void> {
    console.log('Enabling data saving mode...');
    // Reduce image quality, disable auto-sync, etc.
  }

  private async disableDataSavingMode(): Promise<void> {
    console.log('Disabling data saving mode...');
    // Restore full quality and functionality
  }

  // Public API methods
  async recordScreenLoadTime(screenName: string, loadTime: number): Promise<void> {
    if (!this.config.enableMetrics) return;
    
    this.metrics.screenLoadTimes[screenName] = loadTime;
    await this.saveMetrics();
  }

  async recordApiResponseTime(endpoint: string, responseTime: number): Promise<void> {
    if (!this.config.enableMetrics) return;
    
    if (!this.metrics.apiResponseTimes[endpoint]) {
      this.metrics.apiResponseTimes[endpoint] = [];
    }
    
    this.metrics.apiResponseTimes[endpoint].push(responseTime);
    
    // Keep only recent response times
    if (this.metrics.apiResponseTimes[endpoint].length > 50) {
      this.metrics.apiResponseTimes[endpoint] = this.metrics.apiResponseTimes[endpoint].slice(-50);
    }
    
    await this.saveMetrics();
  }

  async recordError(error: Error): Promise<void> {
    this.metrics.errorCount++;
    
    // Log error details for analysis
    console.error('Performance service recorded error:', error);
    
    await this.saveMetrics();
  }

  async recordCrash(): Promise<void> {
    this.metrics.crashCount++;
    await this.saveMetrics();
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Record the measurement
      performance.mark(`${name}-start`);
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      console.log(`${name} took ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.error(`${name} failed after ${duration.toFixed(2)}ms:`, error);
      await this.recordError(error as Error);
      
      throw error;
    }
  }

  measureSync<T>(name: string, fn: () => T): T {
    const startTime = performance.now();
    
    try {
      const result = fn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`${name} took ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.error(`${name} failed after ${duration.toFixed(2)}ms:`, error);
      this.recordError(error as Error);
      
      throw error;
    }
  }

  async runAfterInteractions<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async getPerformanceReport(): Promise<{
    summary: {
      avgScreenLoadTime: number;
      avgApiResponseTime: number;
      memoryUsageAvg: number;
      batteryLevel: number;
      errorRate: number;
    };
    details: PerformanceMetrics;
  }> {
    const screenLoadTimes = Object.values(this.metrics.screenLoadTimes);
    const avgScreenLoadTime = screenLoadTimes.length > 0 
      ? screenLoadTimes.reduce((a, b) => a + b, 0) / screenLoadTimes.length 
      : 0;

    const allApiTimes = Object.values(this.metrics.apiResponseTimes).flat();
    const avgApiResponseTime = allApiTimes.length > 0 
      ? allApiTimes.reduce((a, b) => a + b, 0) / allApiTimes.length 
      : 0;

    const memoryUsages = this.metrics.memoryUsage.map(m => m.jsHeapSizeUsed);
    const memoryUsageAvg = memoryUsages.length > 0 
      ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length 
      : 0;

    const totalOperations = this.metrics.errorCount + 1000; // Assume 1000 successful operations
    const errorRate = this.metrics.errorCount / totalOperations;

    return {
      summary: {
        avgScreenLoadTime,
        avgApiResponseTime,
        memoryUsageAvg,
        batteryLevel: this.metrics.batteryLevel,
        errorRate,
      },
      details: { ...this.metrics },
    };
  }

  async updateConfig(newConfig: Partial<PerformanceConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.saveConfig();
    
    // Restart monitoring with new config
    if (this.isInitialized) {
      this.cleanup();
      await this.initialize();
    }
  }

  // Storage methods
  private async loadMetrics(): Promise<void> {
    try {
      const metricsJson = await AsyncStorage.getItem(PerformanceService.METRICS_KEY);
      if (metricsJson) {
        this.metrics = { ...this.getDefaultMetrics(), ...JSON.parse(metricsJson) };
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  }

  private async saveMetrics(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        PerformanceService.METRICS_KEY,
        JSON.stringify(this.metrics)
      );
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const configJson = await AsyncStorage.getItem(PerformanceService.CONFIG_KEY);
      if (configJson) {
        this.config = { ...this.getDefaultConfig(), ...JSON.parse(configJson) };
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        PerformanceService.CONFIG_KEY,
        JSON.stringify(this.config)
      );
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  async clearMetrics(): Promise<void> {
    this.metrics = this.getDefaultMetrics();
    await AsyncStorage.removeItem(PerformanceService.METRICS_KEY);
  }

  cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    if (this.batteryCheckInterval) {
      clearInterval(this.batteryCheckInterval);
      this.batteryCheckInterval = null;
    }

    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }

    this.isInitialized = false;
  }
}

export const performanceService = new PerformanceService();