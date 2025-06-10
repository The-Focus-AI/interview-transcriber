import { secondsToTimestamp, timestampToSeconds, adjustTimestamp } from '../src/utils/timeUtils';

describe('Time Utilities', () => {
  describe('secondsToTimestamp', () => {
    it('should convert seconds to timestamp format', () => {
      expect(secondsToTimestamp(0)).toBe('00:00:00');
      expect(secondsToTimestamp(60)).toBe('00:01:00');
      expect(secondsToTimestamp(3600)).toBe('01:00:00');
      expect(secondsToTimestamp(3661)).toBe('01:01:01');
      expect(secondsToTimestamp(7325)).toBe('02:02:05');
    });
  });

  describe('timestampToSeconds', () => {
    it('should convert timestamp to seconds', () => {
      expect(timestampToSeconds('00:00:00')).toBe(0);
      expect(timestampToSeconds('00:01:00')).toBe(60);
      expect(timestampToSeconds('01:00:00')).toBe(3600);
      expect(timestampToSeconds('01:01:01')).toBe(3661);
      expect(timestampToSeconds('02:02:05')).toBe(7325);
    });

    it('should throw error for invalid format', () => {
      expect(() => timestampToSeconds('1:00')).toThrow('Invalid timestamp format');
      expect(() => timestampToSeconds('invalid')).toThrow('Invalid timestamp format');
    });
  });

  describe('adjustTimestamp', () => {
    it('should adjust timestamp by offset', () => {
      expect(adjustTimestamp('00:00:00', 60)).toBe('00:01:00');
      expect(adjustTimestamp('00:01:00', -30)).toBe('00:00:30');
      expect(adjustTimestamp('01:00:00', 3600)).toBe('02:00:00');
    });
  });
});