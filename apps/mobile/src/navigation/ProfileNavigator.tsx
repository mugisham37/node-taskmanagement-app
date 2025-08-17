import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { HeaderButton } from '../components/navigation/HeaderButton';
import { AboutScreen } from '../screens/profile/AboutScreen';
import { PreferencesScreen } from '../screens/profile/PreferencesScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { SecurityScreen } from '../screens/profile/SecurityScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { colors } from '../styles/colors';
import { ProfileStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerBackTitleVisible: false,
        gestureEnabled: true,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={({ navigation }) => ({
          title: 'Profile',
          headerLeft: () => (
            <HeaderButton
              icon="menu"
              onPress={() => navigation.openDrawer()}
            />
          ),
          headerRight: () => (
            <HeaderButton
              icon="settings-outline"
              onPress={() => navigation.navigate('Settings')}
            />
          ),
        })}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
      <Stack.Screen
        name="Preferences"
        component={PreferencesScreen}
        options={{
          title: 'Preferences',
        }}
      />
      <Stack.Screen
        name="Security"
        component={SecurityScreen}
        options={{
          title: 'Security',
        }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{
          title: 'About',
        }}
      />
    </Stack.Navigator>
  );
};