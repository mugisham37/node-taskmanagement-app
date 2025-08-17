import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAppDispatch } from '../../store/hooks';
import { colors } from '../../styles/colors';

type ProjectBoardScreenRouteProp = RouteProp<
  { ProjectBoard: { projectId: string } },
  'ProjectBoard'
>;

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  assigneeId?: string;
  dueDate?: string;
}

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width * 0.85;

interface TaskCardProps {
  task: Task;
  onPress: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onPress }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return colors.error;
      case 'MEDIUM':
        return colors.warning;
      case 'LOW':
        return colors.success;
      default:
        return colors.textSecondary;
    }
  };

  return (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle} numberOfLines={2}>
          {task.title}
        </Text>
        <View
          style={[
            styles.priorityIndicator,
            { backgroundColor: getPriorityColor(task.priority) },
          ]}
        />
      </View>
      {task.description && (
        <Text style={styles.taskDescription} numberOfLines={3}>
          {task.description}
        </Text>
      )}
      <View style={styles.taskFooter}>
        {task.dueDate && (
          <View style={styles.dueDateContainer}>
            <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.dueDate}>
              {new Date(task.dueDate).toLocaleDateString()}
            </Text>
          </View>
        )}
        {task.assigneeId && (
          <View style={styles.assigneeContainer}>
            <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

interface ColumnProps {
  title: string;
  status: Task['status'];
  tasks: Task[];
  onTaskPress: (task: Task) => void;
}

const Column: React.FC<ColumnProps> = ({ title, status, tasks, onTaskPress }) => {
  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'TODO':
        return colors.textSecondary;
      case 'IN_PROGRESS':
        return colors.primary;
      case 'REVIEW':
        return colors.warning;
      case 'DONE':
        return colors.success;
      default:
        return colors.textSecondary;
    }
  };

  return (
    <View style={styles.column}>
      <View style={styles.columnHeader}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(status) }]} />
        <Text style={styles.columnTitle}>{title}</Text>
        <Text style={styles.taskCount}>{tasks.length}</Text>
      </View>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskCard task={item} onPress={() => onTaskPress(item)} />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.columnContent}
      />
    </View>
  );
};

export const ProjectBoardScreen: React.FC = () => {
  const route = useRoute<ProjectBoardScreenRouteProp>();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { projectId } = route.params;

  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data for demonstration
  const mockTasks: Task[] = [
    {
      id: '1',
      title: 'Design user interface',
      description: 'Create wireframes and mockups for the new feature',
      status: 'TODO',
      priority: 'HIGH',
      dueDate: '2024-02-15',
    },
    {
      id: '2',
      title: 'Implement authentication',
      description: 'Add login and registration functionality',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
    },
    {
      id: '3',
      title: 'Write unit tests',
      description: 'Add comprehensive test coverage',
      status: 'REVIEW',
      priority: 'LOW',
    },
    {
      id: '4',
      title: 'Deploy to staging',
      description: 'Deploy the latest changes to staging environment',
      status: 'DONE',
      priority: 'MEDIUM',
    },
  ];

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setTasks(mockTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const handleTaskPress = (task: Task) => {
    navigation.navigate('TaskDetail', { taskId: task.id });
  };

  const getTasksByStatus = (status: Task['status']) => {
    return tasks.filter(task => task.status === status);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.boardContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Column
          title="To Do"
          status="TODO"
          tasks={getTasksByStatus('TODO')}
          onTaskPress={handleTaskPress}
        />
        <Column
          title="In Progress"
          status="IN_PROGRESS"
          tasks={getTasksByStatus('IN_PROGRESS')}
          onTaskPress={handleTaskPress}
        />
        <Column
          title="Review"
          status="REVIEW"
          tasks={getTasksByStatus('REVIEW')}
          onTaskPress={handleTaskPress}
        />
        <Column
          title="Done"
          status="DONE"
          tasks={getTasksByStatus('DONE')}
          onTaskPress={handleTaskPress}
        />
      </ScrollView>
    </View>
  );
};
           
const st
yles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  boardContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  column: {
    width: COLUMN_WIDTH,
    marginRight: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  columnTitle: {
    ...typography.subtitle,
    flex: 1,
    color: colors.textPrimary,
  },
  taskCount: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  columnContent: {
    paddingBottom: spacing.sm,
  },
  taskCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  taskTitle: {
    ...typography.body,
    flex: 1,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  priorityIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: spacing.xs,
    marginTop: 2,
  },
  taskDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 16,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueDate: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  assigneeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});