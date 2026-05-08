
import React, { useEffect, useState } from 'react';
import { IcUser } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const RadarPage: React.FC = () => {
    const { bindBack } = useWechatGestures();
    const user = useWechatStore(s => s.user);
    const [stars, setStars] = useState<{ top: string; left: string; size: string; opacity: number }[]>([]);

    useEffect(() => {
        // Generate random stars for the background
        const newStars = Array.from({ length: 60 }).map(() => ({
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            size: `${Math.random() * 2 + 1}px`,
            opacity: Math.random() * 0.7 + 0.3
        }));
        setStars(newStars);
    }, []);

    return (
        <div className="absolute inset-0 bg-(--app-c-overlay-deep-dark) overflow-hidden flex flex-col items-center justify-center z-[110]">
            {/* Starry Background */}
            {stars.map((star, i) => (
                <div 
                    key={i}
                    className="absolute bg-app-surface rounded-full"
                    style={{
                        top: star.top,
                        left: star.left,
                        width: star.size,
                        height: star.size,
                        opacity: star.opacity
                    }}
                />
            ))}

            {/* Exit Button */}
            <button 
                {...bindBack<HTMLButtonElement>()}
                className="absolute top-12 left-6 border border-white/20 px-3 py-1 rounded-[4px] text-white/80 text-(--app-settings-group-title-size) active:bg-white/10 z-20"
            >
                退出
            </button>

            {/* Radar Container */}
            <div className="relative w-(--app-card-width-320) h-(--app-item-height-320) flex items-center justify-center">
                
                {/* Concentric Circles */}
                <div className="absolute inset-0 border border-white/10 rounded-full"></div>
                <div className="absolute inset-[40px] border border-white/10 rounded-full"></div>
                <div className="absolute inset-[80px] border border-white/10 rounded-full"></div>
                <div className="absolute inset-[120px] border border-white/10 rounded-full"></div>

                {/* Radar Scanning Beam */}
                <div className="absolute inset-0 rounded-full overflow-hidden">
                    <div className="radar-beam absolute inset-0"></div>
                </div>

                {/* Central Avatar */}
                <div className="relative z-10 w-(--app-avatar-width-64) h-(--app-avatar-height-64) rounded-full bg-app-surface flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                    <img
                        src={user.avatar}
                        className="w-(--app-card-width-60) h-(--app-item-height-60) rounded-full object-cover"
                        alt="me"
                    />
                </div>
            </div>

            <style>{`
                .radar-beam {
                    background: conic-gradient(from 0deg, transparent 0deg, rgba(255, 255, 255, 0.15) 30deg, transparent 60deg);
                    animation: radar-rotate 4s linear infinite;
                }
                @keyframes radar-rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
