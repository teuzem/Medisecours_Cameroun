export function summarizeRatings(ratings: number[]) {
  if (!ratings.length) return { average: null, count: 0 };
  const total = ratings.reduce((sum, value) => sum + value, 0);
  return { average: Math.round((total / ratings.length) * 100) / 100, count: ratings.length };
}
