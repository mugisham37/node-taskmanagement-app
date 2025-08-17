import { AccessibilityInfo, Platform } from 'react-native';

export interface AccessibilityProps {
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 
    | 'none'
    | 'button'
    | 'link'
    | 'search'
    | 'image'
    | 'keyboardkey'
    | 'text'
    | 'adjustable'
    | 'imagebutton'
    | 'header'
    | 'summary'
    | 'alert'
    | 'checkbox'
    | 'combobox'
    | 'menu'
    | 'menubar'
    | 'menuitem'
    | 'progressbar'
    | 'radio'
    | 'radiogroup'
    | 'scrollbar'
    | 'spinbutton'
    | 'switch'
    | 'tab'
    | 'tablist'
    | 'timer'
    | 'toolbar';
  accessibilityState?: {
    disabled?: boolean;
    selected?: boolean;
    checked?: boolean | 'mixed';
    busy?: boolean;
    expanded?: boolean;
  };
  accessibilityValue?: {
    min?: number;
    max?: number;
    now?: number;
    text?: string;
  };
}

export class AccessibilityManager {
  private static instance: AccessibilityManager;
  private isScreenReaderEnabled = false;
  private isReduceMotionEnabled = false;
  private isReduceTransparencyEnabled = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): AccessibilityManager {
    if (!AccessibilityManager.instance) {
      AccessibilityManager.instance = new AccessibilityManager();
    }
    return AccessibilityManager.instance;
  }

  private async initialize() {
    try {
      this.isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      
      if (Platform.OS === 'ios') {
        this.isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
        this.isReduceTransparencyEnabled = await AccessibilityInfo.isReduceTransparencyEnabled();
      }

      // Listen for changes
      AccessibilityInfo.addEventListener('screenReaderChanged', this.handleScreenReaderChange);
      
      if (Platform.OS === 'ios') {
        AccessibilityInfo.addEventListener('reduceMotionChanged', this.handleReduceMotionChange);
        AccessibilityInfo.addEventListener('reduceTransparencyChanged', this.handleReduceTransparencyChange);
      }
    } catch (error) {
      console.warn('Failed to initialize accessibility manager:', error);
    }
  }

  private handleScreenReaderChange = (isEnabled: boolean) => {
    this.isScreenReaderEnabled = isEnabled;
  };

  private handleReduceMotionChange = (isEnabled: boolean) => {
    this.isReduceMotionEnabled = isEnabled;
  };

  private handleReduceTransparencyChange = (isEnabled: boolean) => {
    this.isReduceTransparencyEnabled = isEnabled;
  };

  public getScreenReaderEnabled(): boolean {
    return this.isScreenReaderEnabled;
  }

  public getReduceMotionEnabled(): boolean {
    return this.isReduceMotionEnabled;
  }

  public getReduceTransparencyEnabled(): boolean {
    return this.isReduceTransparencyEnabled;
  }

  public announceForAccessibility(message: string): void {
    AccessibilityInfo.announceForAccessibility(message);
  }

  public setAccessibilityFocus(reactTag: number): void {
    AccessibilityInfo.setAccessibilityFocus(reactTag);
  }

  public cleanup(): void {
    AccessibilityInfo.removeEventListener('screenReaderChanged', this.handleScreenReaderChange);
    
    if (Platform.OS === 'ios') {
      AccessibilityInfo.removeEventListener('reduceMotionChanged', this.handleReduceMotionChange);
      AccessibilityInfo.removeEventListener('reduceTransparencyChanged', this.handleReduceTransparencyChange);
    }
  }
}

// Utility functions for creating accessible components
export const createAccessibleButton = (
  label: string,
  hint?: string,
  state?: AccessibilityProps['accessibilityState']
): AccessibilityProps => ({
  accessible: true,
  accessibilityRole: 'button',
  accessibilityLabel: label,
  accessibilityHint: hint,
  accessibilityState: state,
});

export const createAccessibleText = (
  label: string,
  role: 'text' | 'header' = 'text'
): AccessibilityProps => ({
  accessible: true,
  accessibilityRole: role,
  accessibilityLabel: label,
});

export const createAccessibleInput = (
  label: string,
  hint?: string,
  value?: string
): AccessibilityProps => ({
  accessible: true,
  accessibilityRole: 'search',
  accessibilityLabel: label,
  accessibilityHint: hint,
  accessibilityValue: value ? { text: value } : undefined,
});

export const createAccessibleCheckbox = (
  label: string,
  checked: boolean,
  hint?: string
): AccessibilityProps => ({
  accessible: true,
  accessibilityRole: 'checkbox',
  accessibilityLabel: label,
  accessibilityHint: hint,
  accessibilityState: { checked },
});

export const createAccessibleSwitch = (
  label: string,
  selected: boolean,
  hint?: string
): AccessibilityProps => ({
  accessible: true,
  accessibilityRole: 'switch',
  accessibilityLabel: label,
  accessibilityHint: hint,
  accessibilityState: { selected },
});

export const createAccessibleProgressBar = (
  label: string,
  progress: number,
  min = 0,
  max = 100
): AccessibilityProps => ({
  accessible: true,
  accessibilityRole: 'progressbar',
  accessibilityLabel: label,
  accessibilityValue: {
    min,
    max,
    now: progress,
    text: `${Math.round((progress / max) * 100)}%`,
  },
});

// Hook for using accessibility manager
export const useAccessibility = () => {
  const manager = AccessibilityManager.getInstance();
  
  return {
    isScreenReaderEnabled: manager.getScreenReaderEnabled(),
    isReduceMotionEnabled: manager.getReduceMotionEnabled(),
    isReduceTransparencyEnabled: manager.getReduceTransparencyEnabled(),
    announceForAccessibility: manager.announceForAccessibility.bind(manager),
    setAccessibilityFocus: manager.setAccessibilityFocus.bind(manager),
  };
};