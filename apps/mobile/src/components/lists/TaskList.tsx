import { Ionicons } from '@expo/vector-icons';
import { Task, TaskPriority, TaskStatus } from '@taskmanagement/types';
import React, { useCallback } from 'react';
import {
  FlatList,
  ListRenderItem,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { SwipeableTaskItem } from './SwipeableTaskItem';

interface TaskListProps {
  tasks: Task[];
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onTaskPress: (task: Task) => void;
  onTaskComplete: (taskId: string) => void;
  onTaskEdit: (taskId: string) => void;
  onTaskDelete: (taskId: string) => void;
  showProject?: boolean;
  emptyMessage?: string;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  loading = false,
  refreshing = false,
  onRefresh,
  onTaskPress,
  onTaskComplete,
  onTaskEdit,
  onTaskDelete,
  showProject = false,
  emptyMessage = 'No tasks found',
}) => {
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TODO:
        return colors.warning;
      case TaskStatus.IN_PROGRESS:
        return colors.info;
      case TaskStatus.COMPLETED:
        return colors.success;
      case TaskStatus.CANCELLED:
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH:
        return 'arrow-up';
      case TaskPriority.MEDIUM:
        return 'remove';
      case TaskPriority.LOW:
        return 'arrow-down';
      default:
        return 'remove';
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH:
        return colors.error;
      case TaskPriority.MEDIUM:
        return colors.warning;
      case TaskPriority.LOW:
        return colors.success;
      default:
        return colors.textSecondary;
    }
  };

  const renderTask: ListRenderItem<Task> = useCallback(
    ({ item: task }) => (
      <SwipeableTaskItem
        task={task}
        onPress={() => onTaskPress(task)}
        onComplete={() => onTaskComplete(task.id)}
        onEdit={() => onTaskEdit(task.id)}
        onDelete={() => onTaskDelete(task.id)}
      >
        <TouchableOpacity
          style={styles.taskItem}
          onPress={() => onTaskPress(task)}
          activeOpacity={0.7}
        >
          <View style={styles.taskHeader}>
            <View style={styles.taskInfo}>
              <Text style={styles.taskTitle} numberOfLines={2}>
                {task.title}
              </Text>
              {task.description && (
                <Text style={styles.taskDescription} numberOfLines={1}>
                  {task.description}
                </Text>
              )}
              {showProject && task.project && (
                <Text style={styles.projectName} numberOfLines={1}>
                  {task.project.name}
                </Text>
              )}
            </View>
            
            <View style={styles.taskMeta}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(task.status) },
                ]}
              >
                <Text style={styles.statusText}>
                  {task.status.replace('_', ' ')}
                </Text>
              </View>
              
              <Ionicons
                name={getPriorityIcon(task.priority)}
                size={16}
                color={getPriorityColor(task.priority)}
                style={styles.priorityIcon}
              />
            </View>
          </View>
          
          <View style={styles.taskFooter}>
            {task.assignee && (
              <View style={styles.assignee}>
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.assigneeText}>
                  {task.assignee.firstName} {task.assignee.lastName}
                </Text>
              </View>
            )}
            
            {task.dueDate && (
              <View style={styles.dueDate}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.dueDateText}>
                  {new Date(task.dueDate).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </SwipeableTaskItem>
    ),
    [onTaskPress, onTaskComplete, onTaskEdit, onTaskDelete, showProject]
  );

  const keyExtractor = useCallback((item: Task) => item.id, []);

  if (loading && tasks.length === 0) {
    return <LoadingSpinner />;
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon="checkbox-outline"
        title="No Tasks"
        message={emptyMessage}
        actionLabel="Create Task"
        onActionPress={() => {
          // Navigate to create task
        }}
      />
    );
  }

  return (
    <FlatList
      data={tasks}
      renderItem={renderTask}
      keyExtractor={keyExtractor}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
  },
  taskItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  taskInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  taskTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  taskDescription: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  projectName: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  taskMeta: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    marginBottom: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  priorityIcon: {
    marginTop: spacing.xs,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assignee: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assigneeText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  dueDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueDateText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  separator: {
    height: spacing.sm,
  },
});