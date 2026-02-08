import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import Level2MenuScreen from '../screens/Level2MenuScreen';
import Practice2HomeScreen from '../screens/Practice2HomeScreen';
import Level2ModeScreen from '../screens/Level2ModeScreen';
import Level2FocusSelectionScreen from '../screens/Level2FocusSelectionScreen';
import Level2FocusModeScreen from '../screens/Level2FocusModeScreen';
import Level2OptimizeModeScreen from '../screens/Level2OptimizeModeScreen';
import Level2MasteryChallengeScreen from '../screens/Level2MasteryChallengeScreen';
import Level2Screen from '../features/levels/Level2/Level2Screen';
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
  Level2Menu: undefined;
  Practice2Home: undefined;
  Level2Learn: undefined;
  Level2FocusSelection: undefined;
  Level2Focus: { headings: string[] };
  Level2Optimize: undefined;
  Level2MasteryChallenge: undefined;
  Level2Mode: undefined;
  Practice2: undefined;
  Practice3: undefined;
  Practice4: undefined;
  Practice5: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Custom back button that navigates to a specific parent screen
function BackButton({ to }: { to: keyof RootStackParamList }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable onPress={() => navigation.navigate(to as any)} style={styles.backBtn}>
      <Text style={styles.backArrow}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  backArrow: { color: '#fff', fontSize: 28, fontWeight: '300' },
});

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
        options={{ title: 'Reciprocal Headings', headerLeft: () => null }}
      />
      <Stack.Screen
        name="Level1Menu"
        component={Level1MenuScreen}
        options={{ title: 'Level 1', headerLeft: () => <BackButton to="Home" /> }}
      />
      <Stack.Screen
        name="PracticeHome"
        component={PracticeHomeScreen}
        options={{ title: 'Practice Mode', headerLeft: () => <BackButton to="Level1Menu" /> }}
      />
      <Stack.Screen
        name="LearnMode"
        component={LearnModeScreen}
        options={{ title: 'Learn Mode', headerLeft: () => <BackButton to="PracticeHome" /> }}
      />
      <Stack.Screen
        name="FocusSelection"
        component={FocusSelectionScreen}
        options={{ title: 'Focus — Select Headings', headerLeft: () => <BackButton to="PracticeHome" /> }}
      />
      <Stack.Screen
        name="FocusMode"
        component={FocusModeScreen}
        options={{ title: 'Focus Mode', headerLeft: () => <BackButton to="FocusSelection" /> }}
      />
      <Stack.Screen
        name="OptimizeMode"
        component={OptimizeModeScreen}
        options={{ title: 'Optimize Mode', headerLeft: () => <BackButton to="PracticeHome" /> }}
      />
      <Stack.Screen
        name="MasteryChallenge"
        component={MasteryChallengeScreen}
        options={{ title: 'Mastery Challenge', headerLeft: () => <BackButton to="Level1Menu" /> }}
      />
      <Stack.Screen
        name="Trial"
        component={TrialScreen}
        options={{ title: 'Trial Mode', headerLeft: () => <BackButton to="Level1Menu" /> }}
      />
      <Stack.Screen
        name="Level2Menu"
        component={Level2MenuScreen}
        options={{ title: 'Level 2', headerLeft: () => <BackButton to="Home" /> }}
      />
      <Stack.Screen
        name="Practice2Home"
        component={Practice2HomeScreen}
        options={{ title: 'Practice Mode', headerLeft: () => <BackButton to="Level2Menu" /> }}
      />
      <Stack.Screen
        name="Level2Learn"
        component={Level2ModeScreen}
        options={{ title: 'Learn Mode', headerLeft: () => <BackButton to="Practice2Home" /> }}
      />
      <Stack.Screen
        name="Level2FocusSelection"
        component={Level2FocusSelectionScreen}
        options={{ title: 'Focus — Select Headings', headerLeft: () => <BackButton to="Practice2Home" /> }}
      />
      <Stack.Screen
        name="Level2Focus"
        component={Level2FocusModeScreen}
        options={{ title: 'Focus Mode', headerLeft: () => <BackButton to="Level2FocusSelection" /> }}
      />
      <Stack.Screen
        name="Level2Optimize"
        component={Level2OptimizeModeScreen}
        options={{ title: 'Optimize Mode', headerLeft: () => <BackButton to="Practice2Home" /> }}
      />
      <Stack.Screen
        name="Level2MasteryChallenge"
        component={Level2MasteryChallengeScreen}
        options={{ title: 'Mastery Challenge', headerLeft: () => <BackButton to="Level2Menu" /> }}
      />
      <Stack.Screen
        name="Level2Mode"
        component={Level2ModeScreen}
        options={{ title: 'Level 2 Mode', headerLeft: () => <BackButton to="Home" /> }}
      />
      <Stack.Screen
        name="Practice2"
        component={Level2Screen}
        options={{ title: 'Level 2 — Practice', headerLeft: () => <BackButton to="Home" /> }}
      />
      <Stack.Screen
        name="Practice3"
        component={Level3Screen}
        options={{ title: 'Level 3 — Practice', headerLeft: () => <BackButton to="Home" /> }}
      />
      <Stack.Screen
        name="Practice4"
        component={Level4Screen}
        options={{ title: 'Level 4 — Practice', headerLeft: () => <BackButton to="Home" /> }}
      />
      <Stack.Screen
        name="Practice5"
        component={Level5Screen}
        options={{ title: 'Level 5 — Practice', headerLeft: () => <BackButton to="Home" /> }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings', headerLeft: () => <BackButton to="Home" /> }}
      />
    </Stack.Navigator>
  );
}
