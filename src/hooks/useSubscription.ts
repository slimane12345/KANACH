import { UserProfile } from '../types';
import { differenceInDays } from 'date-fns';

export const useSubscription = (userProfile: UserProfile | null) => {
  if (!userProfile) return { isTrial: false, isExpired: false, isFeatureEnabled: () => false };

  const now = new Date();
  const trialStartDate = userProfile.trialStartDate ? userProfile.trialStartDate.toDate() : null;
  const isTrial = trialStartDate && differenceInDays(now, trialStartDate) < 14;
  const isExpired = !isTrial && userProfile.subscriptionStatus !== 'active';

  const isFeatureEnabled = (feature: 'pos' | 'barcode' | 'sales' | 'supplier' | 'qrCredit') => {
    if (userProfile.subscriptionStatus === 'active') return true;
    
    if (isTrial) {
      if (['supplier', 'qrCredit'].includes(feature)) return false;
      return true;
    }
    
    return false;
  };

  return { isTrial, isExpired, isFeatureEnabled };
};
