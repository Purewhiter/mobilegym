/**
 * FileManager Navigation Handler
 * 
 * Handles system integration: back handler, route tracking, and navigate function
 */
import React, { useCallback } from 'react';
import { useNavigate, UNSAFE_NavigationContext } from 'react-router-dom';
import { useAppNavigationHandler } from '../../../os/hooks/useAppNavigationHandler';

export const FileManagerNavigationHandler: React.FC = () => {
  const navigate = useNavigate();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);

  const handleBack = useCallback((): boolean => {
    const index = (navigator as any).index || 0;
    if (index > 0) {
      navigate(-1);
      return true;
    }
    return false;
  }, [navigate, navigator]);

  useAppNavigationHandler('file_manager', { onBack: handleBack });
  
  return null;
};
