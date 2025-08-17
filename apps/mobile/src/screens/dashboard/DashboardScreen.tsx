import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { createAccessibleButton, createAccessibleText } from '../../utils/accessibility';

const { width } = Dimensions.get('window');

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  totalProjects: number;
  activeProjects: number;
}

interface QuickAction {
  id: string;
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
}

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { tasks } = useAppSelector((state) => state.tasks);
  const { projects } = useAppSelector((state) => state.projects);

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    overdueTasks: 0,
    totalProjects: 0,
    activeProjects: 0,
  });

  useEffect(() => {
    calculateStats();
  }, [tasks, projects]);

  const calculateStats = () => {
    const taskStats = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(task => task.status === 'DONE').length,
      inProgressTasks: tasks.filter(task => task.status === 'IN_PROGRESS').length,
      overdueTasks: tasks.filter(task => {
        if (!task.dueDate) return false;
        return new Date(task.dueDate) < new Date() && task.status !== 'DONE';
      }).length,
    };

    const projectStats = {
      totalProjects: projects.length,
      activeProjects: projects.filter(project => project.status === 'ACTIVE').length,
    };

    setStats({ ...taskStats, ...projectStats });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const quickActions: QuickAction[] = [
    {
      id: 'create-task',
      title: 'New Task',
      icon: 'add-circle',
      color: colors.primary,
      onPress: () => navigation.navigate('TaskCreate'),
    },
    {
      id: 'create-project',
      title: 'New Project',
      icon: 'folder-open',
      color: colors.success,
      onPress: () => navigation.navigate('ProjectCreate'),
    },
    {
      id: 'view-calendar',
      title: 'Calendar',
      icon: 'calendar',
      color: colors.warning,
      onPress: () => navigation.navigate('Calendar'),
    },
    {
      id: 'view-reports',
      title: 'Reports',
      icon: 'bar-chart',
      color: colors.info,
      onPress: () => navigation.navigate('Reports'),
    },
  ];

  const StatCard: React.FC<{ title: string; value: number; color: string; icon: string }> = ({
    title,
    value,
    color,
    icon,
  }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statContent}>
        <View style={styles.statHeader}>
          <Ionicons name={icon as any} size={20} color={color} />
          <Text style={styles.statValue}>{value}</Text>
        </View>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );

  const QuickActionCard: React.FC<{ action: QuickAction }> = ({ action }) => (
    <TouchableOpacity
      style={styles.quickActionCard}
      onPress={action.onPress}
      {...createAccessibleButton(action.title, `Create a new ${action.title.toLowerCase()}`)}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: action.color }]}>
        <Ionicons name={action.icon as any} size={24} color={colors.white} />
      </View>
      <Text style={styles.quickActionTitle}>{action.title}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning,</Text>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Notifications')}
          {...createAccessibleButton('Notifications', 'View your notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Stats Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle} {...createAccessibleText('Overview', 'header')}>
          Overview
        </Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Tasks"
            value={stats.totalTasks}
            color={colors.primary}
            icon="checkbox-outline"
          />
          <StatCard
            title="Completed"
            value={stats.completedTasks}
            color={colors.success}
            icon="checkmark-circle"
          />
          <StatCard
            title="In Progress"
            value={stats.inProgressTasks}
            color={colors.warning}
            icon="time-outline"
          />
          <StatCard
            title="Overdue"
            value={stats.overdueTasks}
            color={colors.error}
            icon="alert-circle"
          />
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle} {...createAccessibleText('Quick Actions', 'header')}>
          Quick Actions
        </Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <QuickActionCard key={action.id} action={action} />
          ))}
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle} {...createAccessibleText('Recent Activity', 'header')}>
          Recent Activity
        </Text>
        <View style={styles.activityCard}>
          <Text style={styles.activityText}>No recent activity</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  greeting: {
    ...typography.body,
    color: colors.textSecondary,
  },
  userName: {
    ...typography.heading2,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  notificationButton: {
    padding: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: (width - spacing.md * 2 - spacing.sm) / 2,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    borderLeftWidth: 4,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statContent: {
    alignItems: 'flex-start',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.heading2,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  statTitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  quickActionCard: {
    flex: 1,
    minWidth: (width - spacing.md * 2 - spacing.sm) / 2,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '500',
    textAlign: 'center',
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  activityText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});