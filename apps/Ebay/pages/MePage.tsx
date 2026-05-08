import React from 'react';
import { IcCart, IcMail, IcUser, IcNavForward, IcHeart, IcRefresh, IcClose, IcPackage, IcGavel, IcHistory, IcTag, IcLike, IcDislike } from '../res/icons';
import { useEbayGestures } from '../navigation';
import TabBar from '../components/TabBar';
import { useEbayStrings } from '../hooks/useEbayStrings';

const MePage: React.FC = () => {
  const { bindTap, bindAction } = useEbayGestures();
  const s = useEbayStrings();

  return (
    <div className="h-full bg-app-surface flex flex-col relative">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-20" data-scroll-container="me_content" data-scroll-direction="vertical">
          {/* Header */}
          <div className="px-4 py-2 flex items-center justify-between pt-10 sticky top-0 bg-app-surface z-10">
            <h1 className="text-2xl font-bold text-black">{s.me_title}</h1>
            <div className="flex items-center space-x-3">
                 <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                     <IcMail size={20} className="text-app-text" />
                 </div>
                 <div {...bindTap('cart.open', {})} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                     <IcCart size={20} className="text-app-text" />
                 </div>
            </div>
          </div>

          {/* Login Section */}
          <div className="px-4 mt-6 mb-8 flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full border border-gray-300 flex items-center justify-center">
                <IcUser size={32} className="text-app-text" />
            </div>
            <button 
                {...bindAction('me.auth.login')}
                className="text-xl font-bold text-black"
            >
                {s.me_login}
            </button>
          </div>

          {/* Latest News Section */}
          <div className="px-4 mb-6">
            <h2 className="text-lg font-bold mb-3">{s.me_latest_news}</h2>
            <div className="flex space-x-3 overflow-x-auto no-scrollbar pb-2">
                <Card 
                    title={s.me_watchlist} 
                    subtitle={s.me_watchlist_desc} 
                    onClickProps={bindAction('me.card.watchlist')}
                />
                <Card 
                    title={s.me_bids} 
                    subtitle={s.me_bids_desc} 
                    onClickProps={bindAction('me.card.bids')}
                />
            </div>
          </div>

          {/* Info Callout */}
          <div className="px-4 mb-8">
            <div className="bg-blue-50 rounded-xl p-4 relative">
                <div className="flex items-start mb-1">
                    <IcMail size={20} className="text-black mr-2 mt-0.5" />
                    <span className="font-bold text-black">{s.me_looking_for_messages}</span>
                </div>
                <p className="text-black text-sm pl-7">{s.me_messages_moved}</p>
                <button className="absolute top-4 right-4 text-black">
                    <IcClose size={16} />
                </button>
            </div>
          </div>

          {/* Shopping Section */}
          <div className="px-4 mb-6">
              <h2 className="text-xl font-bold mb-4 text-black">{s.me_shopping}</h2>
              <div className="space-y-6">
                   <ListItem 
                      icon={<IcHeart size={24} className="text-black" />} 
                      title={s.me_watchlist} 
                      subtitle={s.me_watchlist_subtitle} 
                   />
                   <ListItem 
                      icon={<IcHeart size={24} className="text-black" />} 
                      title={s.me_saved} 
                      subtitle={s.me_saved_desc} 
                   />
                   <ListItem 
                      icon={<IcRefresh size={24} className="text-black" />} 
                      title={s.me_buy_again} 
                      subtitle={s.me_buy_again_desc} 
                   />
                   <ListItem 
                      icon={<IcPackage size={24} className="text-black" />} 
                      title={s.me_purchases} 
                      subtitle={s.me_purchases_desc} 
                   />
                   <ListItem 
                      icon={<IcGavel size={24} className="text-black" />} 
                      title={s.me_bids} 
                      subtitle={s.me_bids_desc} 
                   />
                   <ListItem 
                      icon={<IcHistory size={24} className="text-black" />} 
                      title={s.me_recently_viewed} 
                      subtitle={s.me_recently_viewed_desc} 
                   />
              </div>
          </div>

          {/* Selling Section */}
          <div className="px-4 mb-6">
              <h2 className="text-xl font-bold mb-4 text-black">{s.me_selling}</h2>
              <div {...bindTap('tab.sell', {})}>
                <ListItem 
                    icon={<IcTag size={24} className="text-black" />} 
                    title={s.me_selling_overview} 
                    subtitle="" 
                    noSubtitle
                />
              </div>
          </div>

          {/* Shortcuts Section */}
          <div className="px-4 mb-6">
              <h2 className="text-xl font-bold mb-4 text-black">{s.me_shortcuts}</h2>
          </div>

          {/* Account Section */}
          <div className="px-4 mb-8">
              <h2 className="text-xl font-bold mb-4 text-black">{s.me_account}</h2>
              <div className="space-y-6">
                  <SimpleListItem text={s.me_payments} />
                  <SimpleListItem text={s.me_help} />
                  <SimpleListItem text={s.me_settings} onClickProps={bindTap('me.settings.open')} />
              </div>
          </div>

          {/* Feedback Section */}
          <div className="px-4 pb-2 text-center border-t border-gray-100 pt-8">
              <p className="text-gray-600 mb-6">{s.me_feedback}</p>
              <div className="flex justify-center space-x-8">
                  <IcLike size={28} className="text-black" />
                  <IcDislike size={28} className="text-black" />
              </div>
          </div>
      </div>
      
      <TabBar />
    </div>
  );
};

const Card = ({ title, subtitle, onClickProps }: any) => (
    <div 
        {...onClickProps}
        className="border border-app-border rounded-xl p-4 min-w-(--app-me-card-min-w) w-[48%] flex-shrink-0 relative bg-app-surface"
    >
        <h3 className="font-bold text-base mb-1">{title}</h3>
        <p className="text-app-text-muted text-xs pr-4">{subtitle}</p>
        <div className="absolute bottom-4 right-4">
            <IcNavForward size={16} className="text-black" />
        </div>
    </div>
);

const ListItem = ({ icon, title, subtitle, noSubtitle }: any) => (
    <div className="flex items-center">
        <div className="w-14 flex justify-center flex-shrink-0 mr-2">
            <div className="w-12 h-12 rounded-full border border-app-border flex items-center justify-center">
                {icon}
            </div>
        </div>
        <div className="flex-1">
            <h3 className="text-base font-medium text-black">{title}</h3>
            {!noSubtitle && <p className="text-app-text-muted text-sm">{subtitle}</p>}
        </div>
    </div>
);

const SimpleListItem = ({ text, onClick, onClickProps }: any) => (
    <div className="text-base text-black pl-2" onClick={onClick} {...onClickProps}>
        {text}
    </div>
);

export default MePage;
