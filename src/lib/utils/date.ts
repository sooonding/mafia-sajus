import {
  format,
  parseISO,
  addMonths,
  startOfMonth,
  endOfMonth,
  formatDistanceToNow,
} from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 날짜 유틸리티 (date-fns 기반)
 */

/**
 * 날짜 포맷팅
 *
 * @param date 날짜 (Date 또는 ISO 문자열)
 * @param formatStr 포맷 문자열 (기본: 'yyyy-MM-dd')
 * @returns 포맷된 날짜 문자열
 */
export const formatDate = (
  date: Date | string,
  formatStr = 'yyyy-MM-dd'
): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: ko });
};

/**
 * 상대 날짜 표시
 *
 * @param date 날짜
 * @returns 상대 날짜 문자열 (예: "3일 전", "방금")
 */
export const formatRelativeDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { locale: ko, addSuffix: true });
};

/**
 * 구독 시작일 기준 월별 시작/끝 날짜 계산
 *
 * @param startedAt 구독 시작일
 * @param now 현재 날짜 (기본: 현재 시각)
 * @returns 이번 달 시작일과 끝일
 */
export const getSubscriptionPeriod = (
  startedAt: Date,
  now = new Date()
): { start: Date; end: Date } => {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  return {
    start: monthStart,
    end: monthEnd,
  };
};

/**
 * 날짜 유효성 검증 (출생일)
 *
 * @param date 날짜
 * @returns 유효하면 true
 */
export const isValidBirthDate = (date: Date): boolean => {
  const now = new Date();
  const minDate = new Date('1900-01-01');
  return date >= minDate && date <= now;
};
