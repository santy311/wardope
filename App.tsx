import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import AddClothesScreen from './screens/AddClothesScreen';
import MatchClothesScreen from './screens/MatchClothesScreen';

const Tab = createBottomTabNavigator();

// Custom Tab Bar Component
const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.tabBarGradient}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          // Get icon name based on route
          const getIconName = () => {
            if (route.name === 'AddClothes') {
              return 'shirt';
            } else if (route.name === 'MatchClothes') {
              return 'camera';
            }
            return 'help-outline';
          };

          // Get label based on route
          const getLabel = () => {
            if (route.name === 'AddClothes') {
              return 'My Clothes';
            } else if (route.name === 'MatchClothes') {
              return 'Match Clothes';
            }
            return route.name;
          };

          return (
            <View key={route.key} style={styles.tabItem}>
              <TouchableOpacity
                style={[styles.tabButton, isFocused && styles.tabButtonActive]}
                onPress={onPress}
                onLongPress={onLongPress}
              >
                <Ionicons
                  name={getIconName()}
                  size={24}
                  color={isFocused ? '#667eea' : 'rgba(0, 0, 0, 0.6)'}
                />
                <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                  {getLabel()}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        tabBar={props => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="AddClothes"
          component={AddClothesScreen}
          options={{
            headerShown: false,
          }}
        />
        <Tab.Screen
          name="MatchClothes"
          component={MatchClothesScreen}
          options={{
            headerShown: false,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  tabBarGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 15, // Account for home indicator on newer iPhones
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 0,
    minWidth: 60,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  tabButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.6)',
    marginTop: 4,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#667eea',
    fontWeight: '600',
  },
});
