import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';
import { useCamera } from '../../hooks/useCamera';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { mobileServicesManager } from '../../services';
import { pushNotificationService } from '../../services/notifications/PushNotificationService';
import { performanceService } from '../../services/performance/PerformanceService';

interface FeatureCardProps {
  title: string;
  description: string;
  status: 'enabled' | 'disabled' | 'loading' | 'error';
  onPress?: () => void;
  children?: React.ReactNode;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  status,
  onPress,
  children,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'enabled': return '#4CAF50';
      case 'disabled': return '#9E9E9E';
      case 'loading': return '#FF9800';
      case 'error': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'enabled': return 'Enabled';
      case 'disabled': return 'Disabled';
      case 'loading': return 'Loading...';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.featureCard, { borderLeftColor: getStatusColor() }]}
      onPress={onPress}
      disabled={status === 'loading'}
    >
      <View style={styles.featureHeader}>
        <Text style={styles.featureTitle}>{title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>
      <Text style={styles.featureDescription}>{description}</Text>
      {children}
    </TouchableOpacity>
  );
};

export const AdvancedFeaturesScreen: React.FC = () => {
  const [serviceStatus, setServiceStatus] = useState<any>({});
  const [healthCheck, setHealthCheck] = useState<any>({});
  const [performanceReport, setPerformanceReport] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  // Hooks for advanced features
  const syncState = useOfflineSync();
  const biometricAuth = useBiometricAuth();
  const camera = useCamera();

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    tasks: true,
    projects: true,
    reminders: true,
    system: false,
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [status, health, performance, notifPrefs] = await Promise.all([
        mobileServicesManager.getServiceStatus(),
        mobileServicesManager.performHealthCheck(),
        performanceService.getPerformanceReport(),
        pushNotificationService.getNotificationPreferences?.() || {},
      ]);

      setServiceStatus(status);
      setHealthCheck(health);
      setPerformanceReport(performance);
      setNotificationSettings(prev => ({ ...prev, ...notifPrefs }));
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfflineSync = async () => {
    try {
      const result = await syncState.performSync();
      Alert.alert(
        'Sync Complete',
        `Synced ${result.syncedItems} items. ${result.failedItems} failed.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Sync Failed', 'Failed to sync data. Please try again.');
    }
  };

  const handleBiometricToggle = async () => {
    if (biometricAuth.isEnabled) {
      const success = await biometricAuth.disableBiometric();
      if (success) {
        Alert.alert('Success', 'Biometric authentication disabled');
      }
    } else {
      Alert.alert(
        'Enable Biometric Authentication',
        'This will securely store your login credentials for quick access.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              // In a real app, you would get these from the current user session
              const success = await biometricAuth.enableBiometric('user@example.com', 'auth-token');
              if (success) {
                Alert.alert('Success', 'Biometric authentication enabled');
              }
            },
          },
        ]
      );
    }
  };

  const handleCameraTest = async () => {
    const permissions = await camera.checkPermissions();
    if (!permissions.camera) {
      const granted = await camera.requestPermissions();
      if (!granted.camera) {
        Alert.alert('Permission Required', 'Camera permission is required for this feature.');
        return;
      }
    }

    Alert.alert(
      'Camera Test',
      'Choose an option to test camera functionality',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => testTakePhoto() },
        { text: 'Scan Document', onPress: () => testDocumentScan() },
        { text: 'Pick from Gallery', onPress: () => testPickImage() },
      ]
    );
  };

  const testTakePhoto = async () => {
    const result = await camera.takePhoto({
      quality: 0.8,
      allowsEditing: true,
    });

    if (result) {
      Alert.alert('Success', `Photo taken: ${result.width}x${result.height}`);
    }
  };

  const testDocumentScan = async () => {
    const result = await camera.scanDocument();
    if (result) {
      Alert.alert('Success', `Document scanned with ${result.totalPages} page(s)`);
    }
  };

  const testPickImage = async () => {
    const result = await camera.pickImage();
    if (result) {
      Alert.alert('Success', `Image selected: ${result.width}x${result.height}`);
    }
  };

  const handleNotificationTest = async () => {
    try {
      await pushNotificationService.sendLocalNotification({
        id: 'test-notification',
        title: 'Test Notification',
        body: 'This is a test notification from the advanced features screen.',
        channelId: 'system',
      });
      Alert.alert('Success', 'Test notification sent');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const handleNotificationSettingChange = async (key: string, value: boolean) => {
    const newSettings = { ...notificationSettings, [key]: value };
    setNotificationSettings(newSettings);
    
    try {
      await pushNotificationService.updateNotificationPreferences(newSettings);
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
    }
  };

  const handlePerformanceMaintenance = async () => {
    Alert.alert(
      'Performance Maintenance',
      'This will clean up temporary files and optimize app performance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            try {
              await mobileServicesManager.performMaintenance();
              await loadInitialData();
              Alert.alert('Success', 'Maintenance completed successfully');
            } catch (error) {
              Alert.alert('Error', 'Maintenance failed. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getFeatureStatus = (isEnabled: boolean, hasError: boolean, isLoading: boolean) => {
    if (isLoading) return 'loading';
    if (hasError) return 'error';
    return isEnabled ? 'enabled' : 'disabled';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading advanced features...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Advanced Features</Text>
        
        {/* Health Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Health</Text>
          <View style={[styles.healthCard, { 
            backgroundColor: healthCheck.healthy ? '#E8F5E8' : '#FFF3E0' 
          }]}>
            <Text style={styles.healthStatus}>
              Status: {healthCheck.healthy ? '✅ Healthy' : '⚠️ Issues Detected'}
            </Text>
            {healthCheck.issues?.length > 0 && (
              <Text style={styles.healthIssues}>
                Issues: {healthCheck.issues.join(', ')}
              </Text>
            )}
          </View>
        </View>

        {/* Offline Sync */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offline Sync</Text>
          <FeatureCard
            title="Data Synchronization"
            description="Sync your data when online. Keep working offline."
            status={getFeatureStatus(
              syncState.isOnline,
              !!syncState.syncError,
              syncState.isSyncing
            )}
            onPress={handleOfflineSync}
          >
            <View style={styles.syncDetails}>
              <Text style={styles.detailText}>
                📱 Online: {syncState.isOnline ? 'Yes' : 'No'}
              </Text>
              <Text style={styles.detailText}>
                📊 Pending: {syncState.pendingChanges} items
              </Text>
              {syncState.lastSyncTime && (
                <Text style={styles.detailText}>
                  🕒 Last sync: {syncState.lastSyncTime.toLocaleTimeString()}
                </Text>
              )}
            </View>
          </FeatureCard>
        </View>

        {/* Biometric Authentication */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Biometric Authentication</Text>
          <FeatureCard
            title={biometricAuth.biometricType}
            description="Secure and convenient authentication using biometrics."
            status={getFeatureStatus(
              biometricAuth.isEnabled,
              !!biometricAuth.error,
              biometricAuth.isLoading
            )}
            onPress={handleBiometricToggle}
          >
            <View style={styles.biometricDetails}>
              <Text style={styles.detailText}>
                🔒 Available: {biometricAuth.isAvailable ? 'Yes' : 'No'}
              </Text>
              <Text style={styles.detailText}>
                ⚙️ Enabled: {biometricAuth.isEnabled ? 'Yes' : 'No'}
              </Text>
            </View>
          </FeatureCard>
        </View>

        {/* Camera & Document Scanning */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Camera & Document Scanning</Text>
          <FeatureCard
            title="Camera Integration"
            description="Take photos, scan documents, and manage media files."
            status={getFeatureStatus(
              camera.hasPermissions,
              !!camera.error,
              camera.isLoading
            )}
            onPress={handleCameraTest}
          >
            <View style={styles.cameraDetails}>
              <Text style={styles.detailText}>
                📷 Permissions: {camera.hasPermissions ? 'Granted' : 'Not granted'}
              </Text>
              {camera.lastImage && (
                <Text style={styles.detailText}>
                  🖼️ Last image: {camera.lastImage.width}x{camera.lastImage.height}
                </Text>
              )}
            </View>
          </FeatureCard>
        </View>

        {/* Push Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Notifications</Text>
          <FeatureCard
            title="Notification System"
            description="Receive real-time updates and reminders."
            status={getFeatureStatus(
              !!pushNotificationService.pushToken,
              false,
              false
            )}
            onPress={handleNotificationTest}
          >
            <View style={styles.notificationSettings}>
              {Object.entries(notificationSettings).map(([key, value]) => (
                <View key={key} style={styles.settingRow}>
                  <Text style={styles.settingLabel}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Text>
                  <Switch
                    value={value}
                    onValueChange={(newValue) => handleNotificationSettingChange(key, newValue)}
                  />
                </View>
              ))}
            </View>
          </FeatureCard>
        </View>

        {/* Performance Monitoring */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <FeatureCard
            title="Performance Monitoring"
            description="Monitor app performance and optimize resource usage."
            status="enabled"
            onPress={handlePerformanceMaintenance}
          >
            <View style={styles.performanceDetails}>
              <Text style={styles.detailText}>
                ⚡ Avg Screen Load: {performanceReport.summary?.avgScreenLoadTime?.toFixed(0) || 0}ms
              </Text>
              <Text style={styles.detailText}>
                🌐 Avg API Response: {performanceReport.summary?.avgApiResponseTime?.toFixed(0) || 0}ms
              </Text>
              <Text style={styles.detailText}>
                🔋 Battery: {performanceReport.summary?.batteryLevel?.toFixed(0) || 100}%
              </Text>
              <Text style={styles.detailText}>
                ❌ Error Rate: {((performanceReport.summary?.errorRate || 0) * 100).toFixed(1)}%
              </Text>
            </View>
          </FeatureCard>
        </View>

        {/* Service Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Status</Text>
          <View style={styles.serviceGrid}>
            {Object.entries(serviceStatus).map(([service, status]) => (
              <View key={service} style={styles.serviceItem}>
                <Text style={styles.serviceName}>
                  {service.charAt(0).toUpperCase() + service.slice(1)}
                </Text>
                <Text style={[
                  styles.serviceStatus,
                  { color: status ? '#4CAF50' : '#F44336' }
                ]}>
                  {status ? '✅' : '❌'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  featureCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  syncDetails: {
    marginTop: 8,
  },
  biometricDetails: {
    marginTop: 8,
  },
  cameraDetails: {
    marginTop: 8,
  },
  performanceDetails: {
    marginTop: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  notificationSettings: {
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 14,
    color: '#555',
  },
  healthCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  healthStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  healthIssues: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceItem: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    width: '48%',
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: 14,
    color: '#333',
  },
  serviceStatus: {
    fontSize: 16,
  },
  bottomPadding: {
    height: 40,
  },
});

export default AdvancedFeaturesScreen;