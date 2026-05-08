import { describe, expect, it } from 'vitest';
import { shouldStartWorkspaceMouseDrag } from '../os/launcher/workspaceGesture';

describe('launcher workspace drag arbitration', () => {
  it('only starts the artificial workspace drag for mouse input', () => {
    expect(shouldStartWorkspaceMouseDrag('mouse')).toBe(true);
    expect(shouldStartWorkspaceMouseDrag('touch')).toBe(false);
    expect(shouldStartWorkspaceMouseDrag('pen')).toBe(false);
  });
});
