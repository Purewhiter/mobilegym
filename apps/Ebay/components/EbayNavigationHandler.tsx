import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation, UNSAFE_NavigationContext } from 'react-router-dom';
import { useAppNavigationHandler } from '../../../os/hooks/useAppNavigationHandler';

export const EbayNavigationHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);
  const historyIndexRef = useRef(0);

  useEffect(() => {
    const memoryNavigator = navigator as any;
    if (typeof memoryNavigator?.index === 'number') {
      historyIndexRef.current = memoryNavigator.index;
    }
  }, [location, navigator]);

  const handleBackPress = useCallback((): boolean => {
    const memoryNavigator = navigator as any;
    const currentIndex =
      typeof memoryNavigator?.index === 'number' ? memoryNavigator.index : historyIndexRef.current;

    if (currentIndex > 0) {
      navigate(-1);
      return true;
    }
    return false;
  }, [navigate, navigator]);

  useAppNavigationHandler('ebay', { onBack: handleBackPress });

  return null;
};
