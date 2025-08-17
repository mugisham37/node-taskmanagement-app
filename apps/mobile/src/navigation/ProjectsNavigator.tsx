import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { ProjectCreateScreen } from '@screens/projects/ProjectCreateScreen';
import { ProjectDetailScreen } from '@screens/projects/ProjectDetailScreen';
import { ProjectEditScreen } from '@screens/projects/ProjectEditScreen';
import { ProjectsListScreen } from '@screens/projects/ProjectsListScreen';

export type ProjectsStackParamList = {
  ProjectsList: undefined;
  ProjectDetail: { projectId: string };
  ProjectCreate: undefined;
  ProjectEdit: { projectId: string };
};

const Stack = createNativeStackNavigator<ProjectsStackParamList>();

export const ProjectsNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerBackTitleVisible: false,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen 
        name="ProjectsList" 
        component={ProjectsListScreen}
        options={{ title: 'Projects' }}
      />
      <Stack.Screen 
        name="ProjectDetail" 
        component={ProjectDetailScreen}
        options={{ title: 'Project Details' }}
      />
      <Stack.Screen 
        name="ProjectCreate" 
        component={ProjectCreateScreen}
        options={{ 
          title: 'Create Project',
          presentation: 'modal',
        }}
      />
      <Stack.Screen 
        name="ProjectEdit" 
        component={ProjectEditScreen}
        options={{ 
          title: 'Edit Project',
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
};