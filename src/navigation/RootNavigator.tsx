import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { DashboardScreen } from "../screens/DashboardScreen";
import { GamesScreen } from "../screens/GamesScreen";
import { JournalScreen } from "../screens/JournalScreen";

export type RootTabParamList = {
  Dashboard: undefined;
  Jurnal: undefined;
  Games: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: "#101622" },
          headerTintColor: "#fff",
          tabBarStyle: { backgroundColor: "#0d1321", borderTopColor: "rgba(255,255,255,0.12)" },
          tabBarActiveTintColor: "#7ca6ff",
          tabBarInactiveTintColor: "rgba(255,255,255,0.65)",
        }}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Jurnal" component={JournalScreen} />
        <Tab.Screen name="Games" component={GamesScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

