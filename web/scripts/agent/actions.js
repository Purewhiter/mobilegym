// Shared action protocol for the browser agent.
//
// Keep these names aligned with bench_env.env.base.ActionType. Agents emit
// plain {type, data} actions using this protocol; runners and executors consume
// only this shape.

export const ActionType = Object.freeze({
  CLICK: 'CLICK',
  DOUBLE_TAP: 'DOUBLE_TAP',
  LONG_PRESS: 'LONG_PRESS',
  TYPE: 'TYPE',
  SWIPE: 'SWIPE',
  DRAG: 'DRAG',
  BACK: 'BACK',
  HOME: 'HOME',
  RECENT: 'RECENT',
  ENTER: 'ENTER',
  WAIT: 'WAIT',
  AWAKE: 'AWAKE',
  ANSWER: 'ANSWER',
  COMPLETE: 'COMPLETE',
  ABORT: 'ABORT',
  INFO: 'INFO',
  NOOP: 'NOOP',
});

export class ActionFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FormatError';
  }
}

export function isTerminalAction(type) {
  return type === ActionType.COMPLETE || type === ActionType.ABORT;
}

export function isControlAction(type) {
  return (
    type === ActionType.ANSWER
    || type === ActionType.COMPLETE
    || type === ActionType.ABORT
    || type === ActionType.INFO
    || type === ActionType.NOOP
  );
}

export function parseNormPoint(point) {
  let p = point;
  if (p === null || p === undefined) {
    p = [500, 500];
  }
  if (!Array.isArray(p) || p.length < 2) {
    throw new ActionFormatError(`Invalid point format: ${JSON.stringify(point)}`);
  }
  const x = Number(p[0]);
  const y = Number(p[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new ActionFormatError(`Invalid point format: ${JSON.stringify(point)}`);
  }
  return [
    Math.max(0, Math.min(1000, x)),
    Math.max(0, Math.min(1000, y)),
  ];
}

export function makeAction(type, data = {}) {
  return { type, data };
}
