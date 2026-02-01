import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import LearningScreen from '../screens/LearningScreen';
import TrialScreen from '../screens/TrialScreen';
import SettingsScreen from '../screens/SettingsScreen';
import Level2Screen from '../features/levels/Level2/Level2Screen';
import Level3Screen from '../features/levels/Level3/Level3Screen';
import Level4Screen from '../features/levels/Level4/Level4Screen';
import Level5Screen from '../features/levels/Level5/Level5Screen';

export type RootStackParamList = {
  Home: undefined;
  Learning: { stage: number };
  Trial: { stage: number };
  Practice2: undefined;
  Practice3: undefined;
  Practice4: undefined;
  Practice5: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Reciprocal Headings' }}
      />
      <Stack.Screen
        name="Learning"
        component={LearningScreen}
        options={({ route }) => ({
          title: `Stage ${route.params.stage}`,
        })}
      />
      <Stack.Screen
        name="Trial"
        component={TrialScreen}
        options={({ route }) => ({
          title: `Trial — Stage ${route.params.stage}`,
        })}
      />
      <Stack.Screen
        name="Practice2"
        component={Level2Screen}
        options={{ title: 'Level 2 — Practice' }}
      />
      <Stack.Screen
        name="Practice3"
        component={Level3Screen}
        options={{ title: 'Level 3 — Practice' }}
      />
      <Stack.Screen
        name="Practice4"
        component={Level4Screen}
        options={{ title: 'Level 4 — Practice' }}
      />
      <Stack.Screen
        name="Practice5"
        component={Level5Screen}
        options={{ title: 'Level 5 — Practice' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Stack.Navigator>
  );
}
