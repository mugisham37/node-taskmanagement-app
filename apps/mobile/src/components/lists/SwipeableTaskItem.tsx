import { Ionicons } from '@expo/vector-icons';
import { Task } from '@taskmanagement/types';
import React, { useRef } from 'react';
import {
    Animated,
    PanGestureHandler,
    PanGestureHandlerGestureEvent,
    State,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';

interface SwipeableTaskItemProps {
  task: Task;
  children: React.ReactNode;
  onPress: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const SWIPE_THRESHOLD = 100;
const ACTION_WIDTH = 80;

export const SwipeableTaskItem: React.FC<SwipeableTaskItemProps> = ({
  task,
  children,
  onPress,
  onComplete,
  onEdit,
  onDelete,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: false }
  );

  const onHandlerStateChange = (event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationX } = event.nativeEvent;
      const offset = lastOffset.current + translationX;

      if (Math.abs(offset) > SWIPE_THRESHOLD) {
        // Snap to action position
        const targetOffset = offset > 0 ? ACTION_WIDTH * 2 : -ACTION_WIDTH * 2;
        Animated.spring(translateX, {
          toValue: targetOffset,
          useNativeDriver: false,
        }).start();
        lastOffset.current = targetOffset;
      } else {
        // Snap back to center
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
        lastOffset.current = 0;
      }
    }
  };

  const resetPosition = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
    lastOffset.current = 0;
  };

  const handleComplete = () => {
    onComplete();
    resetPosition();
  };

  const handleEdit = () => {
    onEdit();
    resetPosition();
  };

  const handleDelete = () => {
    onDelete();
    resetPosition();
  };

  const isCompleted = task.status === TaskStatus.COMPLETED;

  return (
    <View style={styles.container}>
      {/* Left Actions */}
      <View style={styles.leftActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.completeButton]}
          onPress={handleComplete}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isCompleted ? 'checkmark-done' : 'checkmark'}
            size={24}
            color={colors.surface}
          />
          <Text style={styles.actionText}>
            {isCompleted ? 'Done' : 'Complete'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={handleEdit}
          activeOpacity={0.7}
        >
          <Ionicons name="create" size={24} color={colors.surface} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Right Actions */}
      <View style={styles.rightActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={handleEdit}
          activeOpacity={0.7}
        >
          <Ionicons name="create" size={24} color={colors.surface} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Ionicons name="trash" size={24} color={colors.surface} />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          {children}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  leftActions: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  rightActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  actionButton: {
    width: ACTION_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  completeButton: {
    backgroundColor: colors.success,
  },
  editButton: {
    backgroundColor: colors.info,
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  actionText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  content: {
    backgroundColor: colors.surface,
    zIndex: 2,
  },
});