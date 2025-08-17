import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';

interface MobileInputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  isPassword?: boolean;
  required?: boolean;
  helperText?: string;
}

export const MobileInput = forwardRef<TextInput, MobileInputProps>(
  (
    {
      label,
      error,
      leftIcon,
      rightIcon,
      onRightIconPress,
      isPassword = false,
      required = false,
      helperText,
      style,
      ...props
    },
    ref
  ) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const togglePasswordVisibility = () => {
      setIsPasswordVisible(!isPasswordVisible);
    };

    const hasError = !!error;
    const showPasswordToggle = isPassword && !rightIcon;

    return (
      <View style={styles.container}>
        {label && (
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        )}
        
        <View
          style={[
            styles.inputContainer,
            isFocused && styles.focusedContainer,
            hasError && styles.errorContainer,
            style,
          ]}
        >
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={20}
              color={hasError ? colors.error : colors.textSecondary}
              style={styles.leftIcon}
            />
          )}
          
          <TextInput
            ref={ref}
            style={[
              styles.input,
              leftIcon && styles.inputWithLeftIcon,
              (rightIcon || showPasswordToggle) && styles.inputWithRightIcon,
            ]}
            secureTextEntry={isPassword && !isPasswordVisible}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.primary}
            {...props}
          />
          
          {showPasswordToggle && (
            <TouchableOpacity
              style={styles.rightIcon}
              onPress={togglePasswordVisibility}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isPasswordVisible ? 'eye-off' : 'eye'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
          
          {rightIcon && !showPasswordToggle && (
            <TouchableOpacity
              style={styles.rightIcon}
              onPress={onRightIconPress}
              activeOpacity={0.7}
            >
              <Ionicons
                name={rightIcon}
                size={20}
                color={hasError ? colors.error : colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
        
        {(error || helperText) && (
          <Text style={[styles.helperText, hasError && styles.errorText]}>
            {error || helperText}
          </Text>
        )}
      </View>
    );
  }
);

MobileInput.displayName = 'MobileInput';

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.body2,
    color: colors.text,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  required: {
    color: colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  focusedContainer: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  errorContainer: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    ...typography.body1,
    color: colors.text,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
  },
  inputWithLeftIcon: {
    marginLeft: spacing.sm,
  },
  inputWithRightIcon: {
    marginRight: spacing.sm,
  },
  leftIcon: {
    marginRight: spacing.xs,
  },
  rightIcon: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },
  errorText: {
    color: colors.error,
  },
});