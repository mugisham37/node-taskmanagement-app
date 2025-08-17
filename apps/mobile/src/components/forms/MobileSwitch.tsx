import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Platform,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';

interface MobileSwitchProps {
  label?: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'small' | 'medium' | 'large';
}

export const MobileSwitch: React.FC<MobileSwitchProps> = ({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  icon,
  size = 'medium',
}) => {
  const handlePress = () => {
    if (!disabled) {
      onValueChange(!value);
    }
  };

  const getSwitchSize = () => {
    switch (size) {
      case 'small':
        return { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] };
      case 'large':
        return { transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] };
      default:
        return {};
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.disabledContainer]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      {icon && (
        <View style={styles.iconContainer}>
          <Ionicons
            name={icon}
            size={24}
            color={disabled ? colors.textSecondary : colors.text}
          />
        </View>
      )}
      
      <View style={styles.content}>
        {label && (
          <Text style={[styles.label, disabled && styles.disabledText]}>
            {label}
          </Text>
        )}
        {description && (
          <Text style={[styles.description, disabled && styles.disabledText]}>
            {description}
          </Text>
        )}
      </View>
      
      <View style={[styles.switchContainer, getSwitchSize()]}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{
            false: colors.border,
            true: colors.primaryLight,
          }}
          thumbColor={
            Platform.OS === 'ios'
              ? colors.surface
              : value
              ? colors.primary
              : colors.textSecondary
          }
          ios_backgroundColor={colors.border}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  disabledContainer: {
    opacity: 0.6,
  },
  iconContainer: {
    marginRight: spacing.md,
    width: 32,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginRight: spacing.md,
  },
  label: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '500',
  },
  description: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  disabledText: {
    color: colors.textSecondary,
  },
  switchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});