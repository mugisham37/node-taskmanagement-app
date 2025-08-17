import { colors, commonStyles, typography } from '@styles/index';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const DashboardScreen: React.FC = () => {
  return (
    <View style={[commonStyles.containerCentered, styles.container]}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>Dashboard implementation coming soon</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  title: {
    ...typography.heading1,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});