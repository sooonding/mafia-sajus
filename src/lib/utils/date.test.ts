import {
  formatDate,
  formatRelativeDate,
  getSubscriptionPeriod,
  isValidBirthDate,
} from './date';

describe('formatDate', () => {
  it('기본 포맷(yyyy-MM-dd)으로 날짜를 올바르게 변환해야 한다', () => {
    const date = new Date('2025-10-29T10:00:00Z');
    expect(formatDate(date)).toBe('2025-10-29');
  });

  it('주어진 포맷 문자열에 따라 날짜를 올바르게 변환해야 한다', () => {
    const date = new Date('2025-10-29T10:00:00Z');
    const formatStr = 'yyyy년 MM월 dd일';
    expect(formatDate(date, formatStr)).toBe('2025년 10월 29일');
  });

  it('ISO 문자열을 입력으로 받을 수 있어야 한다', () => {
    const isoString = '2025-10-29T10:00:00Z';
    expect(formatDate(isoString)).toBe('2025-10-29');
  });
});

describe('formatRelativeDate', () => {
  it('Date 객체를 상대 날짜로 변환해야 한다', () => {
    const now = new Date();
    const result = formatRelativeDate(now);
    // "1분 미만 전" 또는 "방금" 같은 결과가 나올 수 있음
    expect(result).toContain('전');
  });

  it('ISO 문자열을 상대 날짜로 변환해야 한다', () => {
    const now = new Date();
    const isoString = now.toISOString();
    const result = formatRelativeDate(isoString);
    expect(result).toContain('전');
  });

  it('과거 날짜를 "전" 형식으로 표시해야 한다', () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    const result = formatRelativeDate(past);
    expect(result).toContain('전');
    expect(result).toContain('일'); // "3일 전" 형식
  });
});

describe('getSubscriptionPeriod', () => {
  it('현재 월의 시작일과 끝일을 반환해야 한다', () => {
    const startedAt = new Date('2025-01-15T00:00:00Z');
    const now = new Date('2025-10-29T10:00:00Z');

    const result = getSubscriptionPeriod(startedAt, now);

    expect(result.start.getFullYear()).toBe(2025);
    expect(result.start.getMonth()).toBe(9); // 10월 (0-indexed)
    expect(result.start.getDate()).toBe(1);
    expect(result.end.getDate()).toBe(31);
  });

  it('now 파라미터를 생략하면 현재 시각을 사용해야 한다', () => {
    const startedAt = new Date('2025-01-15T00:00:00Z');
    const result = getSubscriptionPeriod(startedAt);

    expect(result.start).toBeInstanceOf(Date);
    expect(result.end).toBeInstanceOf(Date);
    expect(result.start.getDate()).toBe(1);
  });
});

describe('isValidBirthDate', () => {
  it('유효한 출생일은 true를 반환해야 한다', () => {
    const validDate = new Date('1990-05-15');
    expect(isValidBirthDate(validDate)).toBe(true);
  });

  it('1900년 이전 날짜는 false를 반환해야 한다', () => {
    const tooOld = new Date('1899-12-31');
    expect(isValidBirthDate(tooOld)).toBe(false);
  });

  it('미래 날짜는 false를 반환해야 한다', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(isValidBirthDate(future)).toBe(false);
  });

  it('1900년 1월 1일은 true를 반환해야 한다 (경계값)', () => {
    const minDate = new Date('1900-01-01');
    expect(isValidBirthDate(minDate)).toBe(true);
  });

  it('오늘 날짜는 true를 반환해야 한다 (경계값)', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(isValidBirthDate(today)).toBe(true);
  });
});
