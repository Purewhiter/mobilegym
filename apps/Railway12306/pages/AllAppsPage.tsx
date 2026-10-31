import React from 'react';
import { IcNavBack } from '../res/icons';
import { RAILWAY12306_CONFIG } from '../data';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { ServiceGrid } from '../components/ServiceGrid';
import type { AppRoute } from '../../../os/navigation';
import { routes } from '../routes';

const ALL_APPS_NAV_MAP: Record<string, AppRoute> = {
  station_screen: routes.stationBoard,
  timetable: routes.timetable,
  air_rail: routes.airRail,
  bus_ship: routes.busTicket,
  invoice: routes.invoice,
  warm_service: routes.servicePhone,
  special_passenger: routes.specialPassenger,
  service_phone: routes.servicePhone,
};

export const AllAppsPage: React.FC = () => {
  const config = RAILWAY12306_CONFIG;
  const { bindBack, nav } = useRailwayGestures();
  const s = useRailwayStrings();

  const handleItemClick = (id: string) => {
    const t = ALL_APPS_NAV_MAP[id];
    if (t) nav.push(t);
  };

  const sections = [
    { title: s.all_apps_featured_section, items: config.featuredApps },
    { title: s.all_apps_travel_services_section, items: config.allTravelServices },
    { title: s.all_apps_travel_guide_section, items: config.allTravelGuide },
    { title: s.all_apps_third_party_section, items: config.thirdPartyServices },
    { title: s.all_apps_passenger_services_section, items: config.allWarmServices },
  ];

  return (
    <div className="min-h-full bg-app-bg">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{s.all_apps_title}</span>
      </div>

      {sections.map(section => (
        <div key={section.title} className="mx-3 mt-3 bg-app-surface rounded-xl px-4 py-3">
          <span className="text-base font-medium text-gray-900">{section.title}</span>
          <ServiceGrid items={section.items} columns={5} onItemClick={handleItemClick} />
        </div>
      ))}

      <div className="h-6" />
    </div>
  );
};
