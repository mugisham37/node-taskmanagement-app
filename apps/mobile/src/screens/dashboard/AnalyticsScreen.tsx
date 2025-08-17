import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ProgressBar } from '../../components/common/ProgressBar';
import { RootState } from '../../store';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';

const { width } = Dimensions.get('window');

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  subtitle?: string;
  progress?: number;
}

const AnalyticsCard: React.FC<AnalyticsCardProps> = ({
  title,
  value,
  icon,
  color,
  subtitle,
  progress,
}) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        <Ionicons name={icon} size={24} color={colors.surface} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    
    <Text style={styles.cardValue}>{value}</Text>
    
    {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
    
    {progress !== undefined && (
      <View style={styles.progressContainer}>
        <ProgressBar
          progress={progress}
          height={4}
          progressColor={color}
          backgroundColor={colors.border}
        />
        <Text style={styles.progressText}>{Math.round(progress)}% complete</Text>
      </View>
    )}
  </View>
);

export const AnalyticsScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const { tasks } = useSelector((state: RootState) => state.tasks);
  const { projects } = useSelector((state: RootState) => state.projects);

  useEffect(() => {
    // Simulate loading analytics data
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // Calculate analytics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.status === 'COMPLETED').length;
  const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS').length;
  const overdueTasks = tasks.filter(task => {
    if (!task.dueDate) return false;
    return new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED';
  }).length;

  const totalProjects = projects.length;
  const activeProjects = projects.filter(project => project.status === 'ACTIVE').length;
  const completedProjects = projects.filter(project => project.status === 'COMPLETED').length;

  const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const projectCompletionRate = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;

  if (loading) {
    return <LoadingSpinner message="Loading analytics..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <Text style={styles.sectionTitle}>Task Analytics</Text>
      
      <View style={styles.cardsRow}>
        <AnalyticsCard
          title="Total Tasks"
          value={totalTasks}
          icon="checkbox-outline"
          color={colors.primary}
          subtitle="All tasks"
        />
        
        <AnalyticsCard
          title="Completed"
          value={completedTasks}
          icon="checkmark-circle"
          color={colors.success}
          progress={taskCompletionRate}
        />
      </View>
      
      <View style={styles.cardsRow}>
        <AnalyticsCard
          title="In Progress"
          value={inProgressTasks}
          icon="time-outline"
          color={colors.info}
          subtitle="Active tasks"
        />
        
        <AnalyticsCard
          title="Overdue"
          value={overdueTasks}
          icon="alert-circle"
          color={colors.error}
          subtitle="Past due date"
        />
      </View>

      <Text style={styles.sectionTitle}>Project Analytics</Text>
      
      <View style={styles.cardsRow}>
        <AnalyticsCard
          title="Total Projects"
          value={totalProjects}
          icon="folder-outline"
          color={colors.primary}
          subtitle="All projects"
        />
        
        <AnalyticsCard
          title="Active"
          value={activeProjects}
          icon="play-circle"
          color={colors.success}
          subtitle="In progress"
        />
      </View>
      
      <View style={styles.cardsRow}>
        <AnalyticsCard
          title="Completed"
          value={completedProjects}
          icon="checkmark-done-circle"
          color={colors.info}
          progress={projectCompletionRate}
        />
        
        <AnalyticsCard
          title="Success Rate"
          value={`${Math.round(projectCompletionRate)}%`}
          icon="trending-up"
          color={colors.warning}
          subtitle="Completion rate"
        />
      </View>

      <Text style={styles.sectionTitle}>Performance Metrics</Text>
      
      <View style={styles.fullWidthCard}>
        <AnalyticsCard
          title="Weekly Productivity"
          value="85%"
          icon="bar-chart"
          color={colors.primary}
          subtitle="Tasks completed on time this week"
          progress={85}
        />
      </View>
      
      <View style={styles.fullWidthCard}>
        <AnalyticsCard
          title="Average Task Duration"
          value="2.5 days"
          icon="stopwatch"
          color={colors.info}
          subtitle="Time to complete tasks"
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    width: (width - spacing.md * 3) / 2,
  },
  fullWidthCard: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  cardTitle: {
    ...typography.body2,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  cardValue: {
    ...typography.h2,
    color: colors.text,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  progressContainer: {
    marginTop: spacing.sm,
  },
  progressText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});