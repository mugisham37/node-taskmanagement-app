import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { HeaderButton } from '../components/navigation/HeaderButton';
import { AnalyticsScreen } from '../screens/dashboard/AnalyticsScreen';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { QuickActionsScreen } from '../screens/dashboard/QuickActionsScreen';
import { colors } from '../styles/colors';
import { DashboardStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export const DashboardNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
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
        name="Overview"
        component={DashboardScreen}
        options={({ navigation }) => ({
          title: 'Dashboard',
          headerLeft: () => (
            <HeaderButton
              icon="menu"
              onPress={() => navigation.openDrawer()}
            />
          ),
          headerRight: () => (
            <HeaderButton
              icon="notifications-outline"
              onPress={() => navigation.navigate('Notifications')}
            />
          ),
        })}
      />
      <Stack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          title: 'Analytics',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="QuickActions"
        component={QuickActionsScreen}
        options={{
          title: 'Quick Actions',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
};