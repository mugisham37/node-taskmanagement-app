import React from 'react';
import {
    StyleSheet,
    Text,
    View
} from 'react-native';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { colors } from '../styles/colors';
import { spacing } from '../styles/spacing';
import { typography } from '../styles/typography';

export const LoadingScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          {/* Add your app logo here */}
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>TM</Text>
          </View>
        </View>
        
        <Text style={styles.appName}>Task Management</Text>
        
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoContainer: {
    marginBottom: spacing.xl,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    ...typography.h1,
    color: colors.surface,
    fontWeight: 'bold',
  },
  appName: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body1,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});