import { Ionicons } from '@expo/vector-icons';
import { Project, ProjectStatus } from '@taskmanagement/types';
import React, { useCallback } from 'react';
import {
  FlatList,
  ListRenderItem,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ProgressBar } from '../common/ProgressBar';

interface ProjectListProps {
  projects: Project[];
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onProjectPress: (project: Project) => void;
  onProjectEdit?: (projectId: string) => void;
  showProgress?: boolean;
  emptyMessage?: string;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  loading = false,
  refreshing = false,
  onRefresh,
  onProjectPress,
  onProjectEdit,
  showProgress = true,
  emptyMessage = 'No projects found',
}) => {
  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.PLANNING:
        return colors.warning;
      case ProjectStatus.ACTIVE:
        return colors.success;
      case ProjectStatus.ON_HOLD:
        return colors.info;
      case ProjectStatus.COMPLETED:
        return colors.primary;
      case ProjectStatus.CANCELLED:
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const calculateProgress = (project: Project) => {
    if (!project.tasks || project.tasks.length === 0) return 0;
    const completedTasks = project.tasks.filter(
      task => task.status === 'COMPLETED'
    ).length;
    return (completedTasks / project.tasks.length) * 100;
  };

  const renderProject: ListRenderItem<Project> = useCallback(
    ({ item: project }) => {
      const progress = calculateProgress(project);
      
      return (
        <TouchableOpacity
          style={styles.projectItem}
          onPress={() => onProjectPress(project)}
          activeOpacity={0.7}
        >
          <View style={styles.projectHeader}>
            <View style={styles.projectInfo}>
              <View style={styles.projectTitleRow}>
                <Text style={styles.projectTitle} numberOfLines={2}>
                  {project.name}
                </Text>
                {onProjectEdit && (
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => onProjectEdit(project.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </View>
              
              {project.description && (
                <Text style={styles.projectDescription} numberOfLines={2}>
                  {project.description}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.projectMeta}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(project.status) },
              ]}
            >
              <Text style={styles.statusText}>
                {project.status.replace('_', ' ')}
              </Text>
            </View>

            {project.owner && (
              <View style={styles.owner}>
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.ownerText}>
                  {project.owner.firstName} {project.owner.lastName}
                </Text>
              </View>
            )}
          </View>

          {showProgress && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Progress</Text>
                <Text style={styles.progressPercentage}>
                  {Math.round(progress)}%
                </Text>
              </View>
              <ProgressBar
                progress={progress}
                height={6}
                backgroundColor={colors.border}
                progressColor={colors.primary}
              />
              {project.tasks && (
                <Text style={styles.taskCount}>
                  {project.tasks.filter(t => t.status === 'COMPLETED').length} of{' '}
                  {project.tasks.length} tasks completed
                </Text>
              )}
            </View>
          )}

          <View style={styles.projectFooter}>
            {project.startDate && (
              <View style={styles.dateInfo}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.dateText}>
                  {new Date(project.startDate).toLocaleDateString()}
                </Text>
              </View>
            )}

            {project.endDate && (
              <View style={styles.dateInfo}>
                <Ionicons
                  name="flag-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.dateText}>
                  {new Date(project.endDate).toLocaleDateString()}
                </Text>
              </View>
            )}

            {project.members && project.members.length > 0 && (
              <View style={styles.members}>
                <Ionicons
                  name="people-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.membersText}>
                  {project.members.length} member{project.members.length !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [onProjectPress, onProjectEdit, showProgress]
  );

  const keyExtractor = useCallback((item: Project) => item.id, []);

  if (loading && projects.length === 0) {
    return <LoadingSpinner />;
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon="folder-outline"
        title="No Projects"
        message={emptyMessage}
        actionLabel="Create Project"
        onActionPress={() => {
          // Navigate to create project
        }}
      />
    );
  }

  return (
    <FlatList
      data={projects}
      renderItem={renderProject}
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
  projectItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  projectHeader: {
    marginBottom: spacing.sm,
  },
  projectInfo: {
    flex: 1,
  },
  projectTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  projectTitle: {
    ...typography.h4,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  editButton: {
    padding: spacing.xs,
  },
  projectDescription: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  projectMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  statusText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownerText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    ...typography.body2,
    color: colors.text,
    fontWeight: '500',
  },
  progressPercentage: {
    ...typography.body2,
    color: colors.primary,
    fontWeight: '600',
  },
  taskCount: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
    marginBottom: spacing.xs,
  },
  dateText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  members: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  membersText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  separator: {
    height: spacing.sm,
  },
});