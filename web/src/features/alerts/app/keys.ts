/** Query keys of the feature. Per account, so one account never reads another's cached list. */
export const alertKeys = {
  mine: (accountId: string) => ["alerts", accountId] as const,
};
