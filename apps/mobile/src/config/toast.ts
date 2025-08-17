import { colors } from '@styles/colors';
import React from 'react';
import { BaseToast, ErrorToast, InfoToast } from 'react-native-toast-message';

export const toastConfig = {
  success: (props: any) =>
    React.createElement(BaseToast, {
      ...props,
      style: {
        borderLeftColor: colors.success,
        backgroundColor: colors.background,
      },
      contentContainerStyle: {
        paddingHorizontal: 15,
      },
      text1Style: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
      },
      text2Style: {
        fontSize: 14,
        color: colors.textSecondary,
      },
    }),

  error: (props: any) =>
    React.createElement(ErrorToast, {
      ...props,
      style: {
        borderLeftColor: colors.error,
        backgroundColor: colors.background,
      },
      contentContainerStyle: {
        paddingHorizontal: 15,
      },
      text1Style: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
      },
      text2Style: {
        fontSize: 14,
        color: colors.textSecondary,
      },
    }),

  info: (props: any) =>
    React.createElement(InfoToast, {
      ...props,
      style: {
        borderLeftColor: colors.info,
        backgroundColor: colors.background,
      },
      contentContainerStyle: {
        paddingHorizontal: 15,
      },
      text1Style: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
      },
      text2Style: {
        fontSize: 14,
        color: colors.textSecondary,
      },
    }),

  warning: (props: any) =>
    React.createElement(BaseToast, {
      ...props,
      style: {
        borderLeftColor: colors.warning,
        backgroundColor: colors.background,
      },
      contentContainerStyle: {
        paddingHorizontal: 15,
      },
      text1Style: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
      },
      text2Style: {
        fontSize: 14,
        color: colors.textSecondary,
      },
    }),
};