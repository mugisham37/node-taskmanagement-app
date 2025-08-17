import { Ionicons } from '@expo/vector-icons';
import { DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';

interface DrawerItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  isActive?: boolean;
}

const DrawerItem: React.FC<DrawerItemProps> = ({ icon, label, onPress, isActive }) => (
  <TouchableOpacity
    style={[styles.drawerItem, isActive && styles.activeDrawerItem]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons
      name={icon}
      size={24}
      color={isActive ? colors.primary : colors.textSecondary}
      style={styles.drawerIcon}
    />
    <Text style={[styles.drawerLabel, isActive && styles.activeDrawerLabel]}>
      {label}
    </Text>
  </TouchableOpacity>
);

export const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { navigation } = props;

  const handleLogout = () => {
    dispatch(logout());
  };

  const navigateToScreen = (screenName: string) => {
    navigation.navigate(screenName);
    navigation.closeDrawer();
  };

  return (
    <DrawerContentScrollView {...props} style={styles.container}>
      {/* User Profile Section */}
      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={32} color={colors.textSecondary} />
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
      </View>

      {/* Navigation Items */}
      <View style={styles.navigationSection}>
        <DrawerItem
          icon="home-outline"
          label="Dashboard"
          onPress={() => navigateToScreen('Dashboard')}
        />
        <DrawerItem
          icon="checkbox-outline"
          label="Tasks"
          onPress={() => navigateToScreen('Tasks')}
        />
        <DrawerItem
          icon="folder-outline"
          label="Projects"
          onPress={() => navigateToScreen('Projects')}
        />
        <DrawerItem
          icon="notifications-outline"
          label="Notifications"
          onPress={() => navigateToScreen('Notifications')}
        />
        <DrawerItem
          icon="person-outline"
          label="Profile"
          onPress={() => navigateToScreen('Profile')}
        />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Settings and Support */}
      <View style={styles.settingsSection}>
        <DrawerItem
          icon="settings-outline"
          label="Settings"
          onPress={() => navigateToScreen('Settings')}
        />
        <DrawerItem
          icon="help-circle-outline"
          label="Help & Support"
          onPress={() => {
            // Navigate to help screen or open support
          }}
        />
        <DrawerItem
          icon="information-circle-outline"
          label="About"
          onPress={() => navigateToScreen('About')}
        />
      </View>

      {/* Logout */}
      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  profileSection: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  userEmail: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  navigationSection: {
    paddingTop: spacing.md,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.sm,
    borderRadius: 8,
  },
  activeDrawerItem: {
    backgroundColor: colors.primaryLight,
  },
  drawerIcon: {
    marginRight: spacing.md,
  },
  drawerLabel: {
    ...typography.body1,
    color: colors.textSecondary,
  },
  activeDrawerLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
    marginHorizontal: spacing.lg,
  },
  settingsSection: {
    paddingBottom: spacing.md,
  },
  logoutSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.errorLight,
  },
  logoutText: {
    ...typography.body1,
    color: colors.error,
    marginLeft: spacing.md,
    fontWeight: '600',
  },
});