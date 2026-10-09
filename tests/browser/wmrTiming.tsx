import React from 'react';
import { createRoot } from 'react-dom/client';
import { WmrRenderer } from '../../os/wmr/WmrRenderer';
import * as TimeService from '../../os/TimeService';
import { VarContext } from '../../os/wmr/engine/variables';

declare global {
  interface Window {
    __wmrTimingReview: {
      mode: string;
      TimeService: typeof TimeService;
      samples: Array<{ time: number; text: string }>;
      refreshes: Array<{ time: number }>;
      work?: () => void;
    };
  }
}

const mode = new URLSearchParams(location.search).get('mode') ?? 'wake';
TimeService.useSimulatedTime('2026-10-06 09:00:30', true);
window.__wmrTimingReview = { mode, TimeService, samples: [], refreshes: [] };
const originalFill = CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText = function(text: string, x: number, y: number, maxWidth?: number) {
  window.__wmrTimingReview.samples.push({ time: TimeService.now(), text: String(text) });
  return maxWidth === undefined ? originalFill.call(this, text, x, y) : originalFill.call(this, text, x, y, maxWidth);
};
const originalRefresh = VarContext.prototype.refreshBuiltins;
VarContext.prototype.refreshBuiltins = function() {
  window.__wmrTimingReview.refreshes.push({ time: TimeService.now() });
  originalRefresh.call(this);
  if (mode === 'boundary') window.__wmrTimingReview.work?.();
};
const xml = mode === 'wake'
  ? `<Widget width="300" height="120" frameRate="0" useVariableUpdater="DateTime.Minute"><Var name="changed" expression="0" const="true"/><Var name="derived" expression="#changed * 2"/><ExternalCommands><Trigger action="init"><VariableCommand name="changed" expression="1" delay="20000"/></Trigger></ExternalCommands><Text x="10" y="65" size="48" color="#ffffffff" textExp="'value=' + #derived"/></Widget>`
  : `<Widget width="300" height="120" frameRate="0" useVariableUpdater="DateTime.Minute"><Text x="10" y="65" size="48" color="#ffffffff" textExp="'minute=' + #minute"/></Widget>`;
const bundle = { cacheKey: 'review-' + mode, xml, assetUrlResolver: (src: string) => src };
createRoot(document.getElementById('root')!).render(<div style={{ width: 300, height: 120, background: '#222' }}><WmrRenderer bundleSource={bundle}/></div>);
