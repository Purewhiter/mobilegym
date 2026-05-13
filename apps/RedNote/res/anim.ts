// Animation durations and easing curves — bench_env replaces this file to vary animation speed
export const anim = {
  duration_quick:    '100ms',
  duration_short:    '200ms',
  duration_medium:   '300ms',
  duration_long:     '500ms',
  easing_standard:   'ease-in-out',
  easing_decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  easing_accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  easing_spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;
