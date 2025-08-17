export { colors, darkColors } from './colors';
export { getComponentSpacing, getLayoutSpacing, getSpacing, spacing } from './spacing';
export { typography } from './typography';

// Common style utilities
import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { spacing } from './spacing';

export const commonStyles = StyleSheet.create({
  // Flex utilities
  flex1: {
    flex: 1,
  },
  flexRow: {
    flexDirection: 'row',
  },
  flexColumn: {
    flexDirection: 'column',
  },
  justifyCenter: {
    justifyContent: 'center',
  },
  justifyBetween: {
    justifyContent: 'space-between',
  },
  justifyAround: {
    justifyContent: 'space-around',
  },
  alignCenter: {
    alignItems: 'center',
  },
  alignStart: {
    alignItems: 'flex-start',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },

  // Container utilities
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  containerPadded: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.base,
  },
  containerCentered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Card utilities
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.base,
    marginVertical: spacing.sm,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },

  // Shadow utilities
  shadowSmall: {
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  shadowMedium: {
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  shadowLarge: {
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },

  // Border utilities
  borderRadius: {
    borderRadius: 8,
  },
  borderRadiusSmall: {
    borderRadius: 4,
  },
  borderRadiusLarge: {
    borderRadius: 12,
  },
  borderRadiusFull: {
    borderRadius: 9999,
  },

  // Text utilities
  textCenter: {
    textAlign: 'center',
  },
  textLeft: {
    textAlign: 'left',
  },
  textRight: {
    textAlign: 'right',
  },

  // Margin utilities
  marginVertical: {
    marginVertical: spacing.base,
  },
  marginHorizontal: {
    marginHorizontal: spacing.base,
  },
  marginTop: {
    marginTop: spacing.base,
  },
  marginBottom: {
    marginBottom: spacing.base,
  },

  // Padding utilities
  paddingVertical: {
    paddingVertical: spacing.base,
  },
  paddingHorizontal: {
    paddingHorizontal: spacing.base,
  },
  paddingTop: {
    paddingTop: spacing.base,
  },
  paddingBottom: {
    paddingBottom: spacing.base,
  },

  // Position utilities
  absolute: {
    position: 'absolute',
  },
  relative: {
    position: 'relative',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Overflow utilities
  overflowHidden: {
    overflow: 'hidden',
  },
  overflowVisible: {
    overflow: 'visible',
  },
});