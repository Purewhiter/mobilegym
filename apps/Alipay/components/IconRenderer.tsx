import React from 'react';
import { ICON_REGISTRY, IcTabHome } from '../res/icons';

interface IconRendererProps extends React.ComponentProps<typeof IcTabHome> {
  name: string;
}

export const IconRenderer: React.FC<IconRendererProps> = ({ name, ...props }) => {
  const IconComponent = ICON_REGISTRY[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in ICON_REGISTRY`);
    return null; // Or a fallback icon
  }

  return <IconComponent {...props} />;
};
