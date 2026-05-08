// Keep the daily forecast row responsive in both compact and full-width cards.
export const getDailyForecastGridTemplate = (isEnglish: boolean): string => (
  isEnglish
    ? '78px minmax(0,1fr) 30px max-content 53px max-content'
    : '44px minmax(0,1fr) 30px max-content 53px max-content'
);
