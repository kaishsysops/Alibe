import { createNavigationContainerRef } from "@react-navigation/native";

// Lets non-screen code (notification banners) navigate.
export const navigationRef = createNavigationContainerRef();
