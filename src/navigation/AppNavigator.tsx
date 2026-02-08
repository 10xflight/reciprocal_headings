import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import Level1MenuScreen from '../screens/Level1MenuScreen';
import PracticeHomeScreen from '../screens/PracticeHomeScreen';
import LearnModeScreen from '../screens/LearnModeScreen';
import FocusSelectionScreen from '../screens/FocusSelectionScreen';
import FocusModeScreen from '../screens/FocusModeScreen';
import OptimizeModeScreen from '../screens/OptimizeModeScreen';
import TrialScreen from '../screens/TrialScreen';
import MasteryChallengeScreen from '../screens/MasteryChallengeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import Level2Screen from '../features/levels/Level2/Level2Screen';
import Level2ModeScreen from '../screens/Level2ModeScreen';
import Level3Screen from '../features/levels/Level3/Level3Screen';
import Level4Screen from '../features/levels/Level4/Level4Screen';
import Level5Screen from '../features/levels/Level5/Level5Screen';

export type RootStackParamList = {
  Home: undefined;
  Level1Menu: undefined;
  PracticeHome: undefined;
  LearnMode: undefined;
  FocusSelection: undefined;
  FocusMode: { headings: string[] };
  OptimizeMode: undefined;
  MasteryChallenge: undefined;
  Trial: { headingIds: string[] };
  Level2Mode: undefined;
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
        name="Level1Menu"
        component={Level1MenuScreen}
        options={{ title: 'Level 1' }}
      />
      <Stack.Screen
        name="PracticeHome"
        component={PracticeHomeScreen}
        options={{ title: 'Practice Mode' }}
      />
      <Stack.Screen
        name="LearnMode"
        component={LearnModeScreen}
        options={{ title: 'Learn Mode' }}
      />
      <Stack.Screen
        name="FocusSelection"
        component={FocusSelectionScreen}
        options={{ title: 'Focus — Select Headings' }}
      />
      <Stack.Screen
        name="FocusMode"
        component={FocusModeScreen}
        options={{ title: 'Focus Mode' }}
      />
      <Stack.Screen
        name="OptimizeMode"
        component={OptimizeModeScreen}
        options={{ title: 'Optimize Mode' }}
      />
      <Stack.Screen
        name="MasteryChallenge"
        component={MasteryChallengeScreen}
        options={{ title: 'Mastery Challenge' }}
      />
      <Stack.Screen
        name="Trial"
        component={TrialScreen}
        options={{ title: 'Trial Mode' }}
      />
      <Stack.Screen
        name="Level2Mode"
        component={Level2ModeScreen}
        options={{ title: 'Level 2 Mode' }}
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
