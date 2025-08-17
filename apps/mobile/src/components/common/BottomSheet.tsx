import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    PanGestureHandler,
    State,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';

const { height } = Dimensions.get('window');

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: number[];
  initialSnap?: number;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  snapPoints = [0.3, 0.7],
  initialSnap = 0,
}) => {
  const translateY = useRef(new Animated.Value(height)).current;
  const lastGestureY = useRef(0);

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: height * (1 - snapPoints[initialSnap]),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(translateY, {
        toValue: height,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, snapPoints, initialSnap]);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = event.nativeEvent;
      
      // Determine which snap point to animate to
      let destSnapPoint = snapPoints[0];
      
      if (translationY > height * 0.2 || velocityY > 500) {
        onClose();
        return;
      }
      
      // Find closest snap point
      const currentPosition = (height - translationY) / height;
      let closestSnapIndex = 0;
      let minDistance = Math.abs(currentPosition - snapPoints[0]);
      
      snapPoints.forEach((point, index) => {
        const distance = Math.abs(currentPosition - point);
        if (distance < minDistance) {
          minDistance = distance;
          closestSnapIndex = index;
        }
      });
      
      destSnapPoint = snapPoints[closestSnapIndex];
      
      Animated.spring(translateY, {
        toValue: height * (1 - destSnapPoint),
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          <PanGestureHandler
            onGestureEvent={onGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
          >
            <View style={styles.header}>
              <View style={styles.handle} />
              {title && (
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>{title}</Text>
                </View>
              )}
            </View>
          </PanGestureHandler>
          <View style={styles.content}>
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
  titleContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
});