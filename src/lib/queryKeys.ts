export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  dailyTotals: (userId: string, day: string) =>
    ['daily-totals', userId, day] as const,
  lastWorkout: (userId: string) => ['last-workout', userId] as const,
  workoutHistory: (userId: string) => ['workout-history', userId] as const,
  todayFoodLogs: (userId: string, day: string) =>
    ['today-food-logs', userId, day] as const,
  waterToday: (userId: string, day: string) =>
    ['water-today', userId, day] as const,
  exerciseGroups: () => ['exercise-groups'] as const,
  exercisesByGroup: (groupId: string) =>
    ['exercises-by-group', groupId] as const,
  allExercises: () => ['all-exercises'] as const,
  weeklyActivity: (userId: string, anchor: string) =>
    ['weekly-activity', userId, anchor] as const,
  routines: (userId: string) => ['routines', userId] as const,
  routineDetail: (routineId: string) => ['routine-detail', routineId] as const,
  todaySessions: (userId: string, day: string) =>
    ['today-sessions', userId, day] as const,
  chatMessages: (userId: string) => ['chat-messages', userId] as const,
  chatDailyCount: (userId: string, day: string) =>
    ['chat-daily-count', userId, day] as const,
  aiUsage: (userId: string, feature: string, day: string) =>
    ['ai-usage', userId, feature, day] as const,
};

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
