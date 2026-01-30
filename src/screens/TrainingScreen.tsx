import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import Level1Screen from '../features/levels/Level1/Level1Screen';
import Level2Screen from '../features/levels/Level2/Level2Screen';
import Level3Screen from '../features/levels/Level3/Level3Screen';
import Level4Screen from '../features/levels/Level4/Level4Screen';
import Level5Screen from '../features/levels/Level5/Level5Screen';

type Props = NativeStackScreenProps<RootStackParamList, 'Training'>;

export default function TrainingScreen({ route }: Props) {
  const { level } = route.params;

  switch (level) {
    case 1:
      return <Level1Screen />;
    case 2:
      return <Level2Screen />;
    case 3:
      return <Level3Screen />;
    case 4:
      return <Level4Screen />;
    case 5:
      return <Level5Screen />;
    default:
      return (
        <View style={styles.container}>
          <Text style={styles.text}>Unknown level: {level}</Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 18,
  },
});
