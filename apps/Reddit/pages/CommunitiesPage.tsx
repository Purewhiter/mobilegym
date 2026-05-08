import React from 'react';
import { TopBar } from '../components/TopBar';
import { IcNavForward, IcSend } from '../res/icons';
const asset = (r: unknown) => { const s = String(r ?? '').trim(); return (!s || s.startsWith('http')) ? s : `/@app-assets/Reddit/${s}`; };

const SUGGESTIONS: string[] = [
  // From screenshots + slightly expanded phrasing (no icons)
  'Dress recommendations for a wedding guest (not too formal)',
  'Tips for new parents that you wish you knew earlier',
  'Best robot vacuum for pet hair under $400',
  'GM vs. Tesla: which electric vehicle is a better buy?',
  'How much allowance should I give my kids by age?',
  'Best mechanical keyboards for quiet typing at night',
  'Benefits of different running shoe brands (real differences)',
  'Hardest achievements in Assassin’s Creed games',
  'Best time to visit Japan (weather + crowds + budget)',
  'Best sites to compare flight prices reliably',
  'Best place to find PS5s in stock (online + local)',
  'Best gaming laptop for college and light editing',
  'Tips for Tinder bios that don’t sound cringe',
  'Best beauty subscription boxes actually worth it',
  'Affordable running strollers that aren’t bulky',
  'Biggest home upgrades that add real value',
  'How to stop doomscrolling and focus again',
  'What animated series should I start next (short + bingeable)?',
  'College personal statement tips that actually work',
  'Best ways to save money in 2026 (realistic habits)',
  'Best budget cameras for beginners and creators',
  'Latest YouTube drama everyone is talking about (summary)',
  'Best Xbox games to play in 2025–2026 (co-op + single-player)',
  'Which streaming service is worth it right now?',
  'Why do I feel tired all the time lately?',
  'How do I build a simple workout plan that I can stick to?',
  'Best productivity apps for ADHD (phone-friendly)',
  'What’s the best way to learn Python from scratch?',
  'How to start investing with $100 (without overthinking)',
  'Best phone under $500 for battery + camera',
  'How do I meal prep without eating the same thing all week?',
];

const ANSWERS_LOGO_SRC = asset('others/reddit_answers_logo.png');

const AnswersMark: React.FC = () => {
  return (
    <div className="relative w-24 h-24">
      <div className="absolute left-3 top-2 w-12 h-12 rounded-[28px] bg-[#2EE6A5] shadow-sm" />
      <div className="absolute right-2 top-6 w-12 h-12 rounded-[28px] bg-[#FFD24A] shadow-sm" />
      <div className="absolute left-8 bottom-2 w-12 h-12 rounded-[28px] bg-app-primary shadow-sm" />
    </div>
  );
};

const AutoMarqueeRow: React.FC<{
  items: string[];
  speedPxPerSec?: number;
  className?: string;
}> = ({ items, speedPxPerSec = 26, className }) => {
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;

      const half = content.scrollWidth / 2;
      if (half > 0) {
        scroller.scrollLeft += (speedPxPerSec * dt) / 1000;
        if (scroller.scrollLeft >= half) {
          scroller.scrollLeft -= half;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speedPxPerSec, items.join('|')]);

  return (
    <div ref={scrollerRef} className={`overflow-x-hidden ${className ?? ''}`}>
      <div ref={contentRef} className="flex w-max gap-2 pr-6">
        {[...items, ...items].map((t, idx) => (
          <div
            key={`${t}_${idx}`}
            className="px-3 py-2 rounded-full bg-app-surface border border-app-border text-[13px] text-gray-700 shadow-[0_1px_0_rgba(0,0,0,0.02)] whitespace-nowrap"
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CommunitiesPage: React.FC = () => {
  const [logoFailed, setLogoFailed] = React.useState(false);

  // Split into two balanced rows by alternating indices (keeps variety in both lines)
  const row1 = React.useMemo(() => SUGGESTIONS.filter((_, i) => i % 2 === 0), []);
  const row2 = React.useMemo(() => SUGGESTIONS.filter((_, i) => i % 2 === 1), []);

  return (
    <div className="flex flex-col h-full bg-app-surface">
      <TopBar title="Reddit Answers" rightAction="none" />

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-5 pt-10 pb-6 flex flex-col items-center">
          {logoFailed ? (
            <AnswersMark />
          ) : (
            <img
              src={ANSWERS_LOGO_SRC}
              alt="Reddit Answers"
              className="w-[92px] h-[92px] object-contain"
              draggable={false}
              onError={() => setLogoFailed(true)}
            />
          )}

          <div className="mt-5 text-center">
            <div className="text-app-primary font-black text-[38px] leading-none tracking-tight">
              reddit answers
            </div>
            <div className="mt-2 text-app-text-muted text-sm">来自真实用户的真实回答</div>
          </div>

          {/* Ask box */}
          <div className="mt-6 w-full max-w-[520px]">
            <div className="relative">
              <div className="h-14 rounded-2xl bg-gray-100 border border-app-border flex items-center pl-5 pr-3">
                <input
                  value=""
                  readOnly
                  placeholder="提问"
                  className="flex-1 bg-transparent outline-none text-[18px] text-gray-700 placeholder-gray-400"
                />
                <button
                  type="button"
                  aria-label="Send"
                  className="w-9 h-9 rounded-full bg-app-surface border border-app-border flex items-center justify-center"
                >
                  <IcSend className="w-5 h-5 text-gray-400" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </div>

          {/* Suggestion chips */}
          <div className="mt-5 w-full max-w-[520px] space-y-2">
            <AutoMarqueeRow items={row1} speedPxPerSec={34} />
            <AutoMarqueeRow items={row2} speedPxPerSec={38} />
          </div>

          <button
            type="button"
            className="mt-10 text-gray-400 text-sm flex items-center gap-1"
          >
            <span>了解 Reddit Answers 的工作原理</span>
            <IcNavForward className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
