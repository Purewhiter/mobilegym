import React, { useState } from 'react';
import { useLocale } from '@/os/locale';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { IcCheck, IcSearch } from '../res/icons';
import { localizeSpotifyArtistName } from '../utils/localizeSpotifyText';

interface Artist {
  id: string;
  name: string;
  image: string;
}

const FALLBACK_ARTISTS: Artist[] = [
  { id: '1', name: '周杰伦', image: '/cdn/spotify/images/artists/f4418ae92a1181fc.jpg' },
  { id: '2', name: 'Taylor Swift', image: '/cdn/spotify/images/artists/fe695fd99b055e71.jpg' },
  { id: '3', name: 'Ed Sheeran', image: '/cdn/spotify/images/artists/204a2d03aa647eba.jpg' },
  { id: '4', name: 'Billie Eilish', image: '/cdn/spotify/images/artists/bece0989bfd8bb85.jpg' },
  { id: '5', name: 'The Weeknd', image: '/cdn/spotify/images/artists/44127f0b4e57b6f0.jpg' },
  { id: '6', name: 'Drake', image: '/cdn/spotify/images/artists/c29de0d5c7bb667e.jpg' },
  { id: '7', name: 'Justin Bieber', image: '/cdn/spotify/images/artists/9378211aab39cead.jpg' },
  { id: '8', name: 'BTS', image: '/cdn/spotify/images/artists/44127f0b4e57b6f0.jpg' },
  { id: '9', name: 'Ariana Grande', image: '/cdn/spotify/images/artists/d3cc164641049db1.jpg' },
];

export const ChooseArtistsPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const s = useSpotifyStrings();
  const { bindTap } = useSpotifyGestures();
  const [selectedArtists, setSelectedArtists] = useState<Artist[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const artists = FALLBACK_ARTISTS;

  const toggleSelection = (artist: Artist) => {
    setSelectedArtists((current) =>
      current.find((item) => item.id === artist.id)
        ? current.filter((item) => item.id !== artist.id)
        : [...current, artist],
    );
  };

  const filteredArtists = artists.filter((artist) =>
    localizeSpotifyArtistName(artist.name, isEnglish).toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 animate-in fade-in duration-300 relative">
      <h1 className="text-[28px] font-bold leading-tight mt-8 mb-6 text-center whitespace-pre-line">
        {s.choose_artists_title}
      </h1>

      <div className="relative mb-8">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
          <IcSearch size={22} strokeWidth={2.5} />
        </div>
        <input
          type="text"
          placeholder={s.choose_artists_search}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full bg-white text-black font-bold h-12 rounded pl-12 pr-4 placeholder:text-black outline-none"
        />
      </div>

      <div
        data-scroll-container="main"
        data-scroll-direction="vertical"
        className="grid grid-cols-3 gap-y-8 gap-x-4 pb-24 overflow-y-auto scrollbar-hide"
      >
        {filteredArtists.map((artist) => {
          const isSelected = selectedArtists.some((item) => item.id === artist.id);
          const displayName = localizeSpotifyArtistName(artist.name, isEnglish);
          return (
            <div key={artist.id} className="flex flex-col items-center gap-2" onClick={() => toggleSelection(artist)}>
              <div className="relative w-[100px] h-[100px] rounded-full bg-[#333] transition-transform active:scale-95">
                {artist.image ? (
                  <img src={artist.image} alt={displayName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center text-2xl font-bold text-gray-500">
                    {displayName[0]}
                  </div>
                )}
                {isSelected && (
                  <div className="absolute top-0 right-0 bg-white rounded-full p-1 translate-x-1 -translate-y-1 shadow-md">
                    <IcCheck size={16} className="text-black" strokeWidth={4} />
                  </div>
                )}
              </div>
              <span className="text-[13px] font-bold text-center leading-tight line-clamp-2">
                {displayName}
              </span>
            </div>
          );
        })}
      </div>

      {selectedArtists.length >= 3 && (
        <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-app-surface via-app-surface to-transparent flex justify-center pointer-events-none">
          <button
            className="pointer-events-auto px-12 py-3.5 text-base font-bold text-white transition-all transform hover:scale-105 active:scale-95"
            {...bindTap('auth.signup.complete.open', {
              params: { selectedArtists: JSON.stringify(selectedArtists) },
            })}
          >
            {s.choose_artists_done}
          </button>
        </div>
      )}
    </div>
  );
};
