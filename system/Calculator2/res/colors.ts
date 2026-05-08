export const colors = {
  // Display area

  // Numeric pad
  pad_operator_background: '#636363',
  pad_advanced_background: '#1DE9B6',

  // Button text
  pad_button_advanced_text: 'rgba(0,0,0,0.57)', // #91000000

  // Feedback
  error: '#F40056',
  ripple: 'rgba(255,255,255,0.2)', // #33FFFFFF
  ripple_advanced: 'rgba(0,0,0,0.1)', // #1A000000
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
