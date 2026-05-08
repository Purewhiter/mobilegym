import React, { useEffect, useState } from 'react';
import type { MediaPickerOptions } from '../types';
import { MediaPicker } from './MediaPicker';
import * as MediaService from '../MediaService';

export const MediaPickerHost: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<MediaPickerOptions>({});

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as MediaPickerOptions | undefined;
      setOptions(detail || MediaService.getPickerOptions() || {});
      setVisible(true);
    };
    const handleClose = () => {
      setVisible(false);
      setOptions({});
    };

    window.addEventListener('media-picker-open', handleOpen as EventListener);
    window.addEventListener('media-picker-close', handleClose);
    return () => {
      window.removeEventListener('media-picker-open', handleOpen as EventListener);
      window.removeEventListener('media-picker-close', handleClose);
    };
  }, []);

  return <MediaPicker visible={visible} options={options} />;
};

export default MediaPickerHost;

