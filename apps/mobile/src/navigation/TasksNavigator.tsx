import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { TaskCreateScreen } from '@screens/tasks/TaskCreateScreen';
import { TaskDetailScreen } from '@screens/tasks/TaskDetailScreen';
import { TaskEditScreen } from '@screens/tasks/TaskEditScreen';
import { TasksListScreen } from '@screens/tasks/TasksListScreen';
import { HeaderButton } from '../components/navigation/HeaderButton';
import { colors } from '../styles/colors';
import { TasksStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<TasksStackParamList>();

export const TasksNavigator: React.FC = () => {
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
        name="TaskList" 
        component={TasksListScreen}
        options={({ navigation }) => ({
          title: 'Tasks',
          headerLeft: () => (
            <HeaderButton
              icon="menu"
              onPress={() => navigation.openDrawer()}
            />
          ),
          headerRight: () => (
            <HeaderButton
              icon="add"
              onPress={() => navigation.navigate('TaskCreate')}
            />
          ),
        })}
      />
      <Stack.Screen 
        name="TaskDetail" 
        component={TaskDetailScreen}
        options={({ route, navigation }) => ({
          title: 'Task Details',
          headerRight: () => (
            <HeaderButton
              icon="create-outline"
              onPress={() => navigation.navigate('TaskEdit', { taskId: route.params.taskId })}
            />
          ),
        })}
      />
      <Stack.Screen 
        name="TaskCreate" 
        component={TaskCreateScreen}
        options={{ 
          title: 'Create Task',
          presentation: 'modal',
          headerLeft: () => null,
        }}
      />
      <Stack.Screen 
        name="TaskEdit" 
        component={TaskEditScreen}
        options={{ 
          title: 'Edit Task',
          presentation: 'modal',
          headerLeft: () => null,
        }}
      />
    </Stack.Navigator>
  );
};