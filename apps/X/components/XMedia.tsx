import React from 'react';
import { useXStrings } from '../hooks/useXStrings';

type XImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  active?: boolean;
};

const getProxiedUrl = (url?: string | null) => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) {
    return `/api/gw/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

export function XImage({ src, alt, className }: XImageProps) {
  const [hasError, setHasError] = React.useState(false);
  const [useProxy, setUseProxy] = React.useState(false);
  const [attemptedFallback, setAttemptedFallback] = React.useState(false);
  const s = useXStrings();

  const displaySrc = useProxy ? getProxiedUrl(src) : src;
  const referrerPolicy = src?.includes('twimg.com') && !useProxy ? 'no-referrer' : undefined;

  React.useEffect(() => {
    setHasError(false);
    setUseProxy(false);
    setAttemptedFallback(false);
  }, [src]);

  if (!src) return null;

  if (hasError) {
    return (
      <div className="w-full flex items-center justify-center bg-app-surface text-gray-400 text-sm py-10">
        {s.media_image_load_failed}
      </div>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      {...({ referrerPolicy } as any)}
      loading="lazy"
      onError={() => {
        if (!src) {
          setHasError(true);
          return;
        }

        if (!useProxy) {
          setUseProxy(true);
          return;
        }

        if (!attemptedFallback && !src.includes('twimg.com')) {
          setAttemptedFallback(true);
          setUseProxy(false);
          return;
        }

        setHasError(true);
      }}
    />
  );
}

type XVideoProps = {
  src?: string | null;
  poster?: string | null;
  className?: string;
  active?: boolean;
  autoLoad?: boolean;
};

export function XVideo({ src, poster, className, active = true, autoLoad = false }: XVideoProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = React.useState(false);
  const [loaded, setLoaded] = React.useState(autoLoad);
  const [useProxy, setUseProxy] = React.useState(false);
  const [isInteracting, setIsInteracting] = React.useState(false);
  const s = useXStrings();

  const displaySrc = useProxy ? getProxiedUrl(src) : src;
  const displayPoster = useProxy ? getProxiedUrl(poster) : poster;
  const referrerPolicy = src?.includes('twimg.com') && !useProxy ? 'no-referrer' : undefined;
  const containerClassName = ['relative w-full overflow-hidden bg-app-bg', className].filter(Boolean).join(' ');

  React.useEffect(() => {
    setHasError(false);
    setLoaded(autoLoad);
    setUseProxy(false);
    setIsInteracting(false);
  }, [src, poster, autoLoad]);

  React.useEffect(() => {
    if (active) return;
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [active]);

  React.useEffect(() => {
    if (!active || !containerRef.current) return;

    let loadTimer: NodeJS.Timeout;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        loadTimer = setTimeout(() => {
          setLoaded(true);
        }, 500);

        if (loaded && videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }
      } else {
        clearTimeout(loadTimer);
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      }
    }, { threshold: 0.5 });

    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      clearTimeout(loadTimer);
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    };
  }, [active, loaded]);

  React.useEffect(() => {
    if (active && loaded && videoRef.current && !isInteracting) {
      videoRef.current.play().catch(() => {});
    }
  }, [active, isInteracting, loaded]);

  if (!src) return null;

  if (hasError) {
    return (
      <div className={`${containerClassName} flex flex-col items-center justify-center min-h-[200px]`}>
        {poster && <img src={displayPoster || poster} className="absolute inset-0 w-full h-full object-cover opacity-50 blur-sm" alt="" />}
        <div className="relative z-10 flex flex-col items-center gap-3 p-4 bg-black/60 rounded-xl backdrop-blur-sm">
          <div className="text-gray-200 text-sm font-medium">{s.media_video_load_failed}</div>
          <a className="px-4 py-2 rounded-full bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition-colors" href={src} target="_blank" rel="noreferrer">
            {s.media_video_open_new_window}
          </a>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div ref={containerRef} className={`${containerClassName} flex flex-col items-center justify-center min-h-[200px] cursor-pointer group`} onClick={() => setLoaded(true)}>
        {poster ? (
          <img src={displayPoster || poster} className="absolute inset-0 w-full h-full object-cover" alt="" />
        ) : (
          <div className="absolute inset-0 bg-gray-100 animate-pulse" />
        )}

        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
        <button className="relative z-10 w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110" aria-label="Play video">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 ml-1">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={containerClassName}>
      <video
        ref={videoRef}
        src={displaySrc || undefined}
        poster={displayPoster || poster || undefined}
        controls={isInteracting}
        muted={!isInteracting}
        loop
        playsInline
        preload="metadata"
        className={`w-full h-full ${isInteracting ? 'object-contain' : 'object-cover'} max-h-(--app-feed-image-max-height)`}
        {...({ referrerPolicy } as any)}
        onError={(event) => {
          const media = event.currentTarget;
          const code = media?.error?.code;
          if (code === 1) return;
          if (useProxy) {
            if (src?.includes('twimg.com')) setHasError(true);
            else setUseProxy(false);
          } else {
            setUseProxy(true);
          }
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (!isInteracting) {
            setIsInteracting(true);
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
              void videoRef.current.play();
            }
          }
        }}
      />

      {!isInteracting && (
        <div
          className="absolute bottom-3 right-3 bg-black/60 rounded-full p-2 cursor-pointer hover:bg-black/80 transition-colors"
          onClick={(event) => {
            event.stopPropagation();
            setIsInteracting(true);
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
              void videoRef.current.play();
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        </div>
      )}
    </div>
  );
}
