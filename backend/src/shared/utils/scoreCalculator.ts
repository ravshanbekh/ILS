/**
 * Ball hisoblash yordamchi funksiyalar
 */

export type ResultType = 'green' | 'blue' | 'red';

/**
 * Natija bo'yicha ball hisoblash
 * Yashil (✅) = max_score
 * Ko'k   (☑) = max_score / 2
 * Qizil  (❌) = 0
 */
export const calculateScore = (result: ResultType, maxScore: number): number => {
  switch (result) {
    case 'green':
      return 20;
    case 'blue':
      return 10;
    case 'red':
      return 0;
    default:
      return 0;
  }
};

/**
 * Foiz hisoblash
 */
export const calculatePercentage = (score: number, maxPossible: number): number => {
  if (maxPossible === 0) return 0;
  return Math.round((score / maxPossible) * 100);
};

/**
 * Natija rangi
 */
export const getResultColor = (result: ResultType): string => {
  switch (result) {
    case 'green':
      return '#22c55e';
    case 'blue':
      return '#3b82f6';
    case 'red':
      return '#ef4444';
    default:
      return '#6b7280';
  }
};

/**
 * Natija emoji
 */
export const getResultEmoji = (result: ResultType): string => {
  switch (result) {
    case 'green':
      return '🟢';
    case 'blue':
      return '🔵';
    case 'red':
      return '❌';
    default:
      return '⏳';
  }
};
