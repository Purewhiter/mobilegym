import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('RedBook home feed like binding', () => {
  it('binds the card heart to the note like action without opening the detail page', () => {
    const source = readFileSync(resolve(process.cwd(), 'apps/RedBook/pages/HomePage.tsx'), 'utf-8');

    expect(source).toContain("id: 'note.item.like.toggle'");
    expect(source).toContain("onTrigger: () => toggleLike(note.id)");
    expect(source).toContain('stopPropagation: true');
  });
});
