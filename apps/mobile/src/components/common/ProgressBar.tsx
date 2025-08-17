import React, { useEffect, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    View,
} from 'react-native';
import { colors } from '../../styles/colors';

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  backgroundColor?: string;
  progressColor?: string;
  animated?: boolean;
  duration?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  backgroundColor = colors.border,
  progressColor = colors.primary,
  animated = true,
  duration = 500,
}) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedWidth, {
        toValue: progress,
        duration,
        useNativeDriver: false,
      }).start();
    } else {
      animatedWidth.setValue(progress);
    }
  }, [progress, animated, duration, animatedWidth]);

  return (
    <View
      style={[
        styles.container,
        {
          height,
          backgroundColor,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.progress,
          {
            height,
            backgroundColor: progressColor,
            width: animatedWidth.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            }),
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  progress: {
    borderRadius: 4,
  },
});