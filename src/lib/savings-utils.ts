export function calculateMinimumSavings(targetAmount: number, currentAmount: number, deadlineStr: string): number {
  if (!deadlineStr || targetAmount <= 0 || currentAmount >= targetAmount) {
    return 0;
  }
  
  const deadline = new Date(deadlineStr);
  const now = new Date();
  
  // Set times to midnight to avoid timezone shift weirdness
  deadline.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  // Diff in milliseconds
  const diffMs = deadline.getTime() - now.getTime();
  
  // If deadline is in the past or today, we consider it 1 month for clamping logic
  // to avoid dividing by 0 or negative.
  if (diffMs <= 0) {
    return targetAmount - currentAmount;
  }
  
  // Convert diff to months (approx 30.44 days per month)
  const days = diffMs / (1000 * 60 * 60 * 24);
  const months = Math.max(1, days / 30.44);
  
  const remaining = targetAmount - currentAmount;
  return Math.ceil(remaining / months);
}
