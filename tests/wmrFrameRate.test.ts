import { describe, expect, it } from 'vitest';

import { inferWmrDefaultFrameRate } from '../os/wmr/WmrBundleCache';
import { VarContext } from '../os/wmr/engine/variables';
import type { WmrDocument, WmrFramerateController } from '../os/wmr/engine/types';

function makeDoc(frameRateAttr?: string): Pick<WmrDocument, 'frameRate' | 'root'> {
  return {
    frameRate: frameRateAttr === undefined ? 0 : Number.parseInt(frameRateAttr, 10) || 0,
    root: {
      tag: 'Widget',
      attrs: frameRateAttr === undefined ? {} : { frameRate: frameRateAttr },
      children: [],
    },
  };
}

const controller: WmrFramerateController = {
  name: 'Fra',
  initPause: true,
  loop: false,
  controlPoints: [
    { frameRate: 120, time: 0 },
    { frameRate: 120, time: 6000 },
    { frameRate: 0, time: 6100 },
  ],
};

describe('WMR frame rate inference', () => {
  it('respects explicit root frameRate zero', () => {
    expect(inferWmrDefaultFrameRate(makeDoc('0'), true)).toBe(0);
  });

  it('keeps the legacy animation fallback when frameRate is omitted', () => {
    expect(inferWmrDefaultFrameRate(makeDoc(), true)).toBe(15);
  });

  it('uses positive root frameRate values directly', () => {
    expect(inferWmrDefaultFrameRate(makeDoc('30'), true)).toBe(30);
  });
});

describe('WMR framerate controllers', () => {
  it('only contribute to the recommended frame rate while playing', () => {
    const vars = new VarContext('test-framerate-controller');
    vars.registerFramerateControllers([controller]);

    expect(vars.getRecommendedFrameRate(0)).toBe(0);

    vars.playAnimation('Fra', 'play');
    expect(vars.getRecommendedFrameRate(0)).toBe(120);

    vars.playAnimation('Fra', 'pause');
    expect(vars.getRecommendedFrameRate(0)).toBe(0);
  });
});
