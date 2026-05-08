import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/os/useAppStrings', () => ({
  useAppStrings: () => ({
    media_image_load_failed: 'Image failed',
    media_video_load_failed: 'Video failed',
    media_video_open_new_window: 'Open',
  }),
}));

describe('X media direct loading', () => {
  it('renders twimg images directly before trying the proxy fallback', async () => {
    const { XImage } = await import('../apps/X/components/XMedia');
    const src = 'https://pbs.twimg.com/media/GhV2n2da4AAuy9E.jpg';

    const html = renderToStaticMarkup(React.createElement(XImage, { src, alt: 'post' }));

    expect(html).toContain(`src="${src}"`);
    expect(html).not.toContain('/api/gw/proxy');
  });

  it('renders twimg videos and posters directly before trying the proxy fallback', async () => {
    const { XVideo } = await import('../apps/X/components/XMedia');
    const src = 'https://video.twimg.com/ext_tw_video/sample.mp4';
    const poster = 'https://pbs.twimg.com/media/GhV2n2da4AAuy9E.jpg';

    const html = renderToStaticMarkup(React.createElement(XVideo, { src, poster, autoLoad: true }));

    expect(html).toContain(`src="${src}"`);
    expect(html).toContain(`poster="${poster}"`);
    expect(html).not.toContain('/api/gw/proxy');
  });
});
