import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';

interface QuickActionProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({
  title,
  description,
  icon,
  color,
  onPress,
}) => (
  <TouchableOpacity
    style={styles.actionCard}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.iconContainer, { backgroundColor: color }]}>
      <Ionicons name={icon} size={28} color={colors.surface} />
    </View>
    
    <View style={styles.actionContent}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDescription}>{description}</Text>
    </View>
    
    <Ionicons
      name="chevron-forward"
      size={20}
      color={colors.textSecondary}
    />
  </TouchableOpacity>
);

export const QuickActionsScreen: React.FC = () => {
  const navigation = useNavigation();

  const handleCreateTask = () => {
    navigation.navigate('Tasks', {
      screen: 'TaskCreate',
    });
  };

  const handleCreateProject = () => {
    navigation.navigate('Projects', {
      screen: 'ProjectCreate',
    });
  };

  const handleScanQR = () => {
    Alert.alert(
      'QR Scanner',
      'QR code scanning functionality would be implemented here',
      [{ text: 'OK' }]
    );
  };

  const handleVoiceNote = () => {
    Alert.alert(
      'Voice Note',
      'Voice note recording functionality would be implemented here',
      [{ text: 'OK' }]
    );
  };

  const handleQuickCapture = () => {
    Alert.alert(
      'Quick Capture',
      'Camera capture functionality would be implemented here',
      [{ text: 'OK' }]
    );
  };

  const handleTimeTracker = () => {
    Alert.alert(
      'Time Tracker',
      'Time tracking functionality would be implemented here',
      [{ text: 'OK' }]
    );
  };

  const handleTemplates = () => {
    Alert.alert(
      'Templates',
      'Task and project templates would be shown here',
      [{ text: 'OK' }]
    );
  };

  const handleBulkActions = () => {
    Alert.alert(
      'Bulk Actions',
      'Bulk task management functionality would be implemented here',
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>Create New</Text>
      
      <QuickAction
        title="Create Task"
        description="Add a new task to your workspace"
        icon="add-circle"
        color={colors.primary}
        onPress={handleCreateTask}
      />
      
      <QuickAction
        title="Create Project"
        description="Start a new project with team members"
        icon="folder-open"
        color={colors.success}
        onPress={handleCreateProject}
      />

      <Text style={styles.sectionTitle}>Capture & Input</Text>
      
      <QuickAction
        title="Scan QR Code"
        description="Scan QR codes to quickly add tasks or join projects"
        icon="qr-code"
        color={colors.info}
        onPress={handleScanQR}
      />
      
      <QuickAction
        title="Voice Note"
        description="Record a voice note and convert to task"
        icon="mic"
        color={colors.warning}
        onPress={handleVoiceNote}
      />
      
      <QuickAction
        title="Quick Capture"
        description="Take a photo and attach to a task"
        icon="camera"
        color={colors.error}
        onPress={handleQuickCapture}
      />

      <Text style={styles.sectionTitle}>Productivity Tools</Text>
      
      <QuickAction
        title="Time Tracker"
        description="Start tracking time for your current task"
        icon="stopwatch"
        color={colors.primary}
        onPress={handleTimeTracker}
      />
      
      <QuickAction
        title="Templates"
        description="Use predefined templates for common tasks"
        icon="document-text"
        color={colors.success}
        onPress={handleTemplates}
      />
      
      <QuickAction
        title="Bulk Actions"
        description="Perform actions on multiple tasks at once"
        icon="layers"
        color={colors.info}
        onPress={handleBulkActions}
      />

      <Text style={styles.sectionTitle}>Shortcuts</Text>
      
      <View style={styles.shortcutsGrid}>
        <TouchableOpacity
          style={styles.shortcutCard}
          onPress={() => navigation.navigate('Tasks')}
        >
          <Ionicons name="checkbox" size={24} color={colors.primary} />
          <Text style={styles.shortcutText}>My Tasks</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.shortcutCard}
          onPress={() => navigation.navigate('Projects')}
        >
          <Ionicons name="folder" size={24} color={colors.success} />
          <Text style={styles.shortcutText}>Projects</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.shortcutCard}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications" size={24} color={colors.warning} />
          <Text style={styles.shortcutText}>Notifications</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.shortcutCard}
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons name="person" size={24} color={colors.info} />
          <Text style={styles.shortcutText}>Profile</Text>
        </TouchableOpacity>
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
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  actionDescription: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  shortcutCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutText: {
    ...typography.body2,
    color: colors.text,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});