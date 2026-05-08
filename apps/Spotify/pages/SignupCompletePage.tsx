import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';

export const SignupCompletePage: React.FC = () => {
  const { bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const [searchParams] = useSearchParams();

  const selectedArtistsRaw = searchParams.get('selectedArtists');
  const selectedArtists: any[] = (() => {
    if (!selectedArtistsRaw) return [];
    try {
      const parsed = JSON.parse(selectedArtistsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const displayArtists = selectedArtists.slice(0, 3);

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-6 items-center justify-center animate-in fade-in duration-500">
      <div className="flex items-center justify-center mb-12 h-32 relative">
        {displayArtists.map((artist: any, index: number) => (
          <div
            key={artist.id}
            className={`w-28 h-28 rounded-full overflow-hidden border-2 border-app-surface flex-shrink-0 relative
              ${index === 0 ? 'z-10 translate-x-8' : ''}
              ${index === 1 ? 'z-0 scale-90 opacity-80' : ''}
              ${index === 2 ? 'z-10 -translate-x-8' : ''}
              shadow-2xl
            `}
            style={{
              marginLeft: index === 0 ? 0 : -40,
              zIndex: index === 1 ? 20 : 10,
              transform: index === 1 ? 'scale(1.1)' : 'scale(1)',
              opacity: 1,
            }}
          >
            <img
              src={artist.image}
              alt={artist.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${artist.name}&background=random`;
              }}
            />
          </div>
        ))}
      </div>

      <h1 className="text-2xl font-bold mb-4 text-center">{s.signup_complete_title}</h1>

      <p className="text-app-text-muted text-center mb-16 px-8 leading-relaxed">
        {s.signup_complete_desc}
      </p>

      <button
        className="w-48 bg-white text-black font-bold py-3.5 rounded-full text-base mb-4 active:scale-95 transition-transform"
        {...bindTap('signup.complete.startListening')}
      >
        {s.signup_complete_start}
      </button>

      <button
        className="bg-transparent text-white font-bold py-3 text-sm active:scale-95 transition-transform opacity-80 hover:opacity-100"
        {...bindTap('signup.complete.later')}
      >
        {s.signup_complete_later}
      </button>
    </div>
  );
};
