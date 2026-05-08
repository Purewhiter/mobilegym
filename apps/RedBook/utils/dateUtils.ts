import * as TimeService from '../../../os/TimeService';
import { getRedBookLocale } from '../locale';

export const formatPostTime = (timestamp: number): string => {
  const isEnglish = getRedBookLocale() === 'en';
  const date = TimeService.fromTimestamp(timestamp);
  const now = TimeService.getDate();
  
  // Reset time part for accurate date comparison
  const today = TimeService.fromLocalParts(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = TimeService.fromTimestamp(today.getTime());
  yesterday.setDate(yesterday.getDate() - 1);
  const targetDate = TimeService.fromLocalParts(date.getFullYear(), date.getMonth(), date.getDate());

  const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

  if (targetDate.getTime() === today.getTime()) {
    return isEnglish ? `Today ${timeStr}` : `今天 ${timeStr}`;
  } else if (targetDate.getTime() === yesterday.getTime()) {
    return isEnglish ? `Yesterday ${timeStr}` : `昨天 ${timeStr}`;
  } else {
    // User requested "年月日+时间"
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${timeStr}`;
  }
};

export const formatCommentTime = (timestamp: number): string => {
  const isEnglish = getRedBookLocale() === 'en';
  const date = TimeService.fromTimestamp(timestamp);
  const now = TimeService.getDate();
  const diff = now.getTime() - timestamp;
  
  // < 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    const safeMinutes = minutes <= 0 ? 1 : minutes;
    return isEnglish ? `${safeMinutes} min ago` : `${safeMinutes}分钟前`;
  }
  
  const today = TimeService.fromLocalParts(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = TimeService.fromLocalParts(date.getFullYear(), date.getMonth(), date.getDate());
  
  // If it's today (but >= 1 hour ago)
  if (targetDate.getTime() === today.getTime()) {
      const hours = Math.floor(diff / 3600000);
      return isEnglish ? `${hours} h ago` : `${hours}小时前`;
  }

  // Check if it's yesterday
  const yesterday = TimeService.fromTimestamp(today.getTime());
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (targetDate.getTime() === yesterday.getTime()) {
      const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      return isEnglish ? `Yesterday ${timeStr}` : `昨天 ${timeStr}`;
  }
  
  // Older
  const daysDiff = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff > 7) {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  }
  
  return isEnglish ? `${daysDiff} d ago` : `${daysDiff}天前`;
};
