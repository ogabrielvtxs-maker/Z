/**
 * Utility to track and calculate study consistency and streaks for PMBA students.
 */

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalDaysStudied: number;
  studiedDates: string[]; // YYYY-MM-DD
}

/**
 * Registers today as a studied day for the user and updates streak stats.
 */
export function registerStudyDay(userId: string): StreakStats {
  if (!userId) return { currentStreak: 0, longestStreak: 0, totalDaysStudied: 0, studiedDates: [] };

  const key = `study_streak_data_${userId}`;
  const saved = localStorage.getItem(key);
  
  let stats: StreakStats = {
    currentStreak: 0,
    longestStreak: 0,
    totalDaysStudied: 0,
    studiedDates: []
  };

  if (saved) {
    try {
      stats = JSON.parse(saved);
    } catch (e) {
      console.error("Error parsing streak stats:", e);
    }
  }

  // Get local date YYYY-MM-DD
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  if (!stats.studiedDates) stats.studiedDates = [];

  // Add date if not already present
  if (!stats.studiedDates.includes(todayStr)) {
    stats.studiedDates.push(todayStr);
    stats.totalDaysStudied = stats.studiedDates.length;
  }

  // Sort dates chronologically to calculate streaks
  stats.studiedDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // Calculate current and longest streak
  const calculated = calculateStreaks(stats.studiedDates);
  stats.currentStreak = calculated.current;
  stats.longestStreak = Math.max(stats.longestStreak || 0, calculated.current, calculated.longest);

  localStorage.setItem(key, JSON.stringify(stats));
  return stats;
}

/**
 * Loads the current streak statistics for a student.
 */
export function getStreakStats(userId: string): StreakStats {
  if (!userId) return { currentStreak: 0, longestStreak: 0, totalDaysStudied: 0, studiedDates: [] };
  
  const key = `study_streak_data_${userId}`;
  const saved = localStorage.getItem(key);
  
  if (saved) {
    try {
      const stats: StreakStats = JSON.parse(saved);
      // Double check streaks recalculation to keep it safe from time drifts
      if (stats.studiedDates && stats.studiedDates.length > 0) {
        stats.studiedDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        const calculated = calculateStreaks(stats.studiedDates);
        stats.currentStreak = calculated.current;
        stats.longestStreak = Math.max(stats.longestStreak || 0, calculated.longest, calculated.current);
      }
      return stats;
    } catch (e) {
      // Return empty stats
    }
  }

  return {
    currentStreak: 0,
    longestStreak: 0,
    totalDaysStudied: 0,
    studiedDates: []
  };
}

/**
 * Helper to calculate consecutive days from a sorted array of YYYY-MM-DD dates
 */
function calculateStreaks(dates: string[]): { current: number; longest: number } {
  if (!dates || dates.length === 0) return { current: 0, longest: 0 };

  // Generate today and yesterday string
  const today = new Date();
  const getStr = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  
  const todayStr = getStr(today);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getStr(yesterday);

  let longest = 0;
  let currentStreakCount = 0;
  let tempStreak = 0;

  let lastDate: Date | null = null;

  for (let i = 0; i < dates.length; i++) {
    const currentDate = new Date(dates[i] + "T00:00:00");
    
    if (lastDate === null) {
      tempStreak = 1;
    } else {
      const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        tempStreak += 1;
      } else if (diffDays > 1) {
        longest = Math.max(longest, tempStreak);
        tempStreak = 1; // reset streak
      }
    }
    
    lastDate = currentDate;
  }
  
  longest = Math.max(longest, tempStreak);

  // Determine current active streak.
  // The streak is active if the last studied day is either TODAY or YESTERDAY.
  const lastStudiedDateStr = dates[dates.length - 1];
  if (lastStudiedDateStr === todayStr || lastStudiedDateStr === yesterdayStr) {
    // Current streak is the size of the streak segment ending at lastStudiedDateStr
    let count = 0;
    let targetDate = new Date(lastStudiedDateStr + "T00:00:00");
    
    while (true) {
      const targetStr = getStr(targetDate);
      if (dates.includes(targetStr)) {
        count++;
        // Go back 1 day
        targetDate.setDate(targetDate.getDate() - 1);
      } else {
        break;
      }
    }
    currentStreakCount = count;
  } else {
    currentStreakCount = 0; // Streak broken
  }

  return {
    current: currentStreakCount,
    longest: Math.max(longest, currentStreakCount)
  };
}
