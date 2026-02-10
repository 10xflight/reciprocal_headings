import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
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
import Level3MenuScreen from '../screens/Level3MenuScreen';
import Practice3HomeScreen from '../screens/Practice3HomeScreen';
import Level3ModeScreen from '../screens/Level3ModeScreen';
import Level3FocusSelectionScreen from '../screens/Level3FocusSelectionScreen';
import Level3FocusModeScreen from '../screens/Level3FocusModeScreen';
import Level3OptimizeModeScreen from '../screens/Level3OptimizeModeScreen';
import Level3MasteryChallengeScreen from '../screens/Level3MasteryChallengeScreen';
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
  Level3Menu: undefined;
  Practice3Home: undefined;
  Level3Learn: undefined;
  Level3FocusSelection: undefined;
  Level3Focus: { headings: string[] };
  Level3Optimize: undefined;
  Level3MasteryChallenge: undefined;
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

// Home button
function HomeButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable onPress={() => navigation.navigate('Home')} style={styles.iconBtn}>
      <Text style={styles.iconText}>⌂</Text>
    </Pressable>
  );
}

// Settings button
function SettingsButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable onPress={() => navigation.navigate('Settings')} style={styles.iconBtn}>
      <Text style={styles.iconText}>⚙</Text>
    </Pressable>
  );
}

// Header right with home and settings icons
function HeaderRight({ showHome = true }: { showHome?: boolean }) {
  return (
    <View style={styles.headerRight}>
      {showHome && <HomeButton />}
      <SettingsButton />
    </View>
  );
}

// Breadcrumb title component
function BreadcrumbTitle({ path }: { path: string[] }) {
  return (
    <View style={styles.breadcrumbContainer}>
      <Text style={styles.breadcrumbText} numberOfLines={1}>
        {path.join(' › ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  backArrow: { color: '#fff', fontSize: 28, fontWeight: '300' },
  iconBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  iconText: { color: '#fff', fontSize: 20 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  breadcrumbContainer: { flex: 1, alignItems: 'center' },
  breadcrumbText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
      {/* Home - no home button, just settings */}
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Reciprocal Headings',
          headerLeft: () => null,
          headerRight: () => <HeaderRight showHome={false} />,
        }}
      />

      {/* Level 1 */}
      <Stack.Screen
        name="Level1Menu"
        component={Level1MenuScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L1']} />,
          headerLeft: () => <BackButton to="Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="PracticeHome"
        component={PracticeHomeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L1', 'Practice']} />,
          headerLeft: () => <BackButton to="Level1Menu" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="LearnMode"
        component={LearnModeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L1', 'Practice', 'Learn']} />,
          headerLeft: () => <BackButton to="PracticeHome" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="FocusSelection"
        component={FocusSelectionScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L1', 'Practice', 'Focus']} />,
          headerLeft: () => <BackButton to="PracticeHome" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="FocusMode"
        component={FocusModeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L1', 'Practice', 'Focus']} />,
          headerLeft: () => <BackButton to="FocusSelection" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="OptimizeMode"
        component={OptimizeModeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L1', 'Practice', 'Optimize']} />,
          headerLeft: () => <BackButton to="PracticeHome" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="MasteryChallenge"
        component={MasteryChallengeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L1', 'Mastery']} />,
          headerLeft: () => <BackButton to="Level1Menu" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Trial"
        component={TrialScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L1', 'Trial']} />,
          headerLeft: () => <BackButton to="Level1Menu" />,
          headerRight: () => <HeaderRight />,
        }}
      />

      {/* Level 2 */}
      <Stack.Screen
        name="Level2Menu"
        component={Level2MenuScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L2']} />,
          headerLeft: () => <BackButton to="Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Practice2Home"
        component={Practice2HomeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L2', 'Practice']} />,
          headerLeft: () => <BackButton to="Level2Menu" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Level2Learn"
        component={Level2ModeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L2', 'Practice', 'Learn']} />,
          headerLeft: () => <BackButton to="Practice2Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Level2FocusSelection"
        component={Level2FocusSelectionScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L2', 'Practice', 'Focus']} />,
          headerLeft: () => <BackButton to="Practice2Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Level2Focus"
        component={Level2FocusModeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L2', 'Practice', 'Focus']} />,
          headerLeft: () => <BackButton to="Level2FocusSelection" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Level2Optimize"
        component={Level2OptimizeModeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L2', 'Practice', 'Optimize']} />,
          headerLeft: () => <BackButton to="Practice2Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Level2MasteryChallenge"
        component={Level2MasteryChallengeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L2', 'Mastery']} />,
          headerLeft: () => <BackButton to="Level2Menu" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Level2Mode"
        component={Level2ModeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L2']} />,
          headerLeft: () => <BackButton to="Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />

      {/* Level 3 */}
      <Stack.Screen
        name="Level3Menu"
        component={Level3MenuScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L3']} />,
          headerLeft: () => <BackButton to="Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Practice3Home"
        component={Practice3HomeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L3', 'Practice']} />,
          headerLeft: () => <BackButton to="Level3Menu" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Level3Learn"
        component={Level3ModeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L3', 'Practice', 'Learn']} />,
          headerLeft: () => <BackButton to="Practice3Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Level3FocusSelection"
        component={Level3FocusSelectionScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L3', 'Practice', 'Focus']} />,
          headerLeft: () => <BackButton to="Practice3Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Level3Focus"
        component={Level3FocusModeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L3', 'Practice', 'Focus']} />,
          headerLeft: () => <BackButton to="Level3FocusSelection" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Level3Optimize"
        component={Level3OptimizeModeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L3', 'Practice', 'Optimize']} />,
          headerLeft: () => <BackButton to="Practice3Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Level3MasteryChallenge"
        component={Level3MasteryChallengeScreen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L3', 'Mastery']} />,
          headerLeft: () => <BackButton to="Level3Menu" />,
          headerRight: () => <HeaderRight />,
        }}
      />

      {/* Legacy Practice screens */}
      <Stack.Screen
        name="Practice2"
        component={Level2Screen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L2', 'Practice']} />,
          headerLeft: () => <BackButton to="Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Practice3"
        component={Level3Screen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L3', 'Practice']} />,
          headerLeft: () => <BackButton to="Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Practice4"
        component={Level4Screen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L4', 'Practice']} />,
          headerLeft: () => <BackButton to="Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Practice5"
        component={Level5Screen}
        options={{
          headerTitle: () => <BreadcrumbTitle path={['L5', 'Practice']} />,
          headerLeft: () => <BackButton to="Home" />,
          headerRight: () => <HeaderRight />,
        }}
      />

      {/* Settings - no home button since it's accessible from everywhere */}
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerLeft: () => <BackButton to="Home" />,
          headerRight: () => <HomeButton />,
        }}
      />
    </Stack.Navigator>
  );
}
