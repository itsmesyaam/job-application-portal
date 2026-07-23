import { describe, it, expect } from 'vitest';

/**
 * Replicated core countdown calculation logic from CandidateDashboardClient.tsx
 */
function calculateTimeLeft(deadlineIso: string, nowMs: number): { timeLeft: string; isUrgent: boolean; isOverdue: boolean } {
  const deadlineTime = new Date(deadlineIso).getTime();
  const difference = deadlineTime - nowMs;

  if (difference <= 0) {
    return { timeLeft: 'EXPIRED', isUrgent: false, isOverdue: true };
  }

  const hours = Math.floor(difference / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  return {
    timeLeft: `${formattedHours}:${formattedMinutes}:${formattedSeconds}`,
    isUrgent: hours < 2,
    isOverdue: false,
  };
}

describe('Task Assignment Countdown Timer Logic', () => {
  it('should format remaining time exactly to 48 hours for a newly assigned task', () => {
    const now = Date.now();
    const deadline = new Date(now + 48 * 60 * 60 * 1000).toISOString();
    const result = calculateTimeLeft(deadline, now);
    
    expect(result.timeLeft).toBe('48:00:00');
    expect(result.isUrgent).toBe(false);
    expect(result.isOverdue).toBe(false);
  });

  it('should flag as urgent (isUrgent: true) if less than 2 hours are remaining', () => {
    const now = Date.now();
    const deadline = new Date(now + 1.5 * 60 * 60 * 1000).toISOString();
    const result = calculateTimeLeft(deadline, now);
    
    expect(result.timeLeft).toBe('01:30:00');
    expect(result.isUrgent).toBe(true);
    expect(result.isOverdue).toBe(false);
  });

  it('should flag as expired and overdue once deadline is reached or surpassed', () => {
    const now = Date.now();
    const deadline = new Date(now - 5000).toISOString(); // 5 seconds ago
    const result = calculateTimeLeft(deadline, now);
    
    expect(result.timeLeft).toBe('EXPIRED');
    expect(result.isUrgent).toBe(false);
    expect(result.isOverdue).toBe(true);
  });
});
