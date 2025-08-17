import { colors, commonStyles, typography } from '@styles/index';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const ForgotPasswordScreen: React.FC = () => {
  return (
    <View style={[commonStyles.containerCentered, styles.container]}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>Password recovery implementation coming soon</Text>
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