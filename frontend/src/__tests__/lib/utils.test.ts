import {
  cn,
  formatDate,
  formatRelativeTime,
  formatNumber,
  formatBytes,
  formatPercentage,
  formatDuration,
  getSeverityColor,
  getStatusColor,
  sanitizeInput,
  generateId,
} from '@/lib/utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });

    it('should merge Tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15T10:30:00');
      const formatted = formatDate(date);
      expect(formatted).toMatch(/Jan 15, 2024/);
    });

    it('should handle string dates', () => {
      const formatted = formatDate('2024-01-15T10:30:00');
      expect(formatted).toMatch(/Jan 15, 2024/);
    });
  });

  describe('formatRelativeTime', () => {
    it('should return "just now" for recent dates', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toBe('just now');
    });

    it('should format minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('5m ago');
    });

    it('should format hours ago', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('3h ago');
    });

    it('should format days ago', () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(date)).toBe('2d ago');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers under 1000', () => {
      expect(formatNumber(500)).toBe('500');
    });

    it('should format thousands with K suffix', () => {
      expect(formatNumber(1500)).toBe('1.5K');
    });

    it('should format millions with M suffix', () => {
      expect(formatNumber(1500000)).toBe('1.5M');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1572864)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1610612736)).toBe('1.5 GB');
    });

    it('should handle zero', () => {
      expect(formatBytes(0)).toBe('0 B');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage correctly', () => {
      expect(formatPercentage(0.75)).toBe('75.0%');
      expect(formatPercentage(0.333)).toBe('33.3%');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5.0s');
    });

    it('should format minutes', () => {
      expect(formatDuration(300000)).toBe('5.0m');
    });

    it('should format hours', () => {
      expect(formatDuration(7200000)).toBe('2.0h');
    });
  });

  describe('getSeverityColor', () => {
    it('should return correct color classes for severity', () => {
      expect(getSeverityColor('critical')).toContain('text-red-500');
      expect(getSeverityColor('high')).toContain('text-orange-500');
      expect(getSeverityColor('medium')).toContain('text-yellow-500');
      expect(getSeverityColor('low')).toContain('text-green-500');
      expect(getSeverityColor('info')).toContain('text-blue-500');
    });
  });

  describe('getStatusColor', () => {
    it('should return correct color for status', () => {
      expect(getStatusColor('healthy')).toBe('text-green-500');
      expect(getStatusColor('running')).toBe('text-green-500');
      expect(getStatusColor('warning')).toBe('text-yellow-500');
      expect(getStatusColor('error')).toBe('text-red-500');
      expect(getStatusColor('unknown')).toBe('text-gray-500');
    });
  });

  describe('sanitizeInput', () => {
    it('should escape HTML characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('should escape ampersands', () => {
      expect(sanitizeInput('foo & bar')).toBe('foo &amp; bar');
    });

    it('should escape quotes', () => {
      expect(sanitizeInput("foo's \"bar\"")).toBe("foo&#039;s &quot;bar&quot;");
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate non-empty strings', () => {
      const id = generateId();
      expect(id.length).toBeGreaterThan(0);
    });
  });
});
