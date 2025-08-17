export const spacing = {
  // Base spacing unit (4px)
  unit: 4,

  // Spacing scale
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
  '6xl': 80,
  '7xl': 96,

  // Component-specific spacing
  component: {
    // Button spacing
    buttonPaddingHorizontal: 16,
    buttonPaddingVertical: 12,
    buttonMargin: 8,

    // Input spacing
    inputPaddingHorizontal: 12,
    inputPaddingVertical: 12,
    inputMargin: 8,

    // Card spacing
    cardPadding: 16,
    cardMargin: 12,

    // List spacing
    listItemPadding: 16,
    listItemMargin: 8,

    // Screen spacing
    screenPadding: 16,
    screenMargin: 0,

    // Modal spacing
    modalPadding: 24,
    modalMargin: 16,

    // Header spacing
    headerPadding: 16,
    headerHeight: 56,

    // Tab bar spacing
    tabBarHeight: 60,
    tabBarPadding: 8,

    // Bottom sheet spacing
    bottomSheetPadding: 16,
    bottomSheetMargin: 0,
  },

  // Layout spacing
  layout: {
    // Container spacing
    containerPadding: 16,
    containerMargin: 0,

    // Section spacing
    sectionPadding: 16,
    sectionMargin: 24,

    // Grid spacing
    gridGap: 12,
    gridPadding: 16,

    // Flex spacing
    flexGap: 8,
    flexPadding: 16,
  },

  // Safe area spacing
  safeArea: {
    top: 44, // iOS status bar height
    bottom: 34, // iOS home indicator height
    horizontal: 0,
  },
};

// Helper functions for spacing calculations
export const getSpacing = (multiplier: number): number => {
  return spacing.unit * multiplier;
};

export const getComponentSpacing = (component: keyof typeof spacing.component): number => {
  return spacing.component[component];
};

export const getLayoutSpacing = (layout: keyof typeof spacing.layout): number => {
  return spacing.layout[layout];
};