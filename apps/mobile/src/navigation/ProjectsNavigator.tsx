import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { ProjectBoardScreen } from '@screens/projects/ProjectBoardScreen';
import { ProjectCreateScreen } from '@screens/projects/ProjectCreateScreen';
import { ProjectDetailScreen } from '@screens/projects/ProjectDetailScreen';
import { ProjectEditScreen } from '@screens/projects/ProjectEditScreen';
import { ProjectsListScreen } from '@screens/projects/ProjectsListScreen';
import { HeaderButton } from '../components/navigation/HeaderButton';
import { colors } from '../styles/colors';
import { ProjectsStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<ProjectsStackParamList>();

export const ProjectsNavigator: React.FC = () => {
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
        name="ProjectList" 
        component={ProjectsListScreen}
        options={({ navigation }) => ({
          title: 'Projects',
          headerLeft: () => (
            <HeaderButton
              icon="menu"
              onPress={() => navigation.openDrawer()}
            />
          ),
          headerRight: () => (
            <HeaderButton
              icon="add"
              onPress={() => navigation.navigate('ProjectCreate')}
            />
          ),
        })}
      />
      <Stack.Screen 
        name="ProjectDetail" 
        component={ProjectDetailScreen}
        options={({ route, navigation }) => ({
          title: 'Project Details',
          headerRight: () => (
            <HeaderButton
              icon="create-outline"
              onPress={() => navigation.navigate('ProjectEdit', { projectId: route.params.projectId })}
            />
          ),
        })}
      />
      <Stack.Screen 
        name="ProjectBoard" 
        component={ProjectBoardScreen}
        options={{
          title: 'Project Board',
        }}
      />
      <Stack.Screen 
        name="ProjectCreate" 
        component={ProjectCreateScreen}
        options={{ 
          title: 'Create Project',
          presentation: 'modal',
          headerLeft: () => null,
        }}
      />
      <Stack.Screen 
        name="ProjectEdit" 
        component={ProjectEditScreen}
        options={{ 
          title: 'Edit Project',
          presentation: 'modal',
          headerLeft: () => null,
        }}
      />
    </Stack.Navigator>
  );
};