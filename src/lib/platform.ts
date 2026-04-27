import Constants, { ExecutionEnvironment } from 'expo-constants';

export const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
