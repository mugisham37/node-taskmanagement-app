import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { TaskCreateScreen } from '@screens/tasks/TaskCreateScreen';
import { TaskDetailScreen } from '@screens/tasks/TaskDetailScreen';
import { TaskEditScreen } from '@screens/tasks/TaskEditScreen';
import { TasksListScreen } from '@screens/tasks/TasksListScreen';

export type TasksStackParamList = {
  TasksList: undefined;
  TaskDetail: { taskId: string };
  TaskCreate: { projectId?: string };
  TaskEdit: { taskId: string };
};

const Stack = createNativeStackNavigator<TasksStackParamList>();

export const TasksNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerBackTitleVisible: false,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen 
        name="TasksList" 
        component={TasksListScreen}
        options={{ title: 'Tasks' }}
      />
      <Stack.Screen 
        name="TaskDetail" 
        component={TaskDetailScreen}
        options={{ title: 'Task Details' }}
      />
      <Stack.Screen 
        name="TaskCreate" 
        component={TaskCreateScreen}
        options={{ 
          title: 'Create Task',
          presentation: 'modal',
        }}
      />
      <Stack.Screen 
        name="TaskEdit" 
        component={TaskEditScreen}
        options={{ 
          title: 'Edit Task',
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
};