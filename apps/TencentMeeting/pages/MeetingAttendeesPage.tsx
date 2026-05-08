import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { IcNavBack, IcSearch, IcDownload } from '../res/icons';
import { useMeetingStore } from '../state';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
import { formatAttendeesPageTitle } from '../utils/meetingDataValue';
export const MeetingAttendeesPage: React.FC = () => {
    const { bindBack } = useMeetingGestures();
    const { id } = useParams<{ id: string }>();
    const history = useMeetingStore(s => s.history);
    const [searchText, setSearchText] = useState('');
    const s = useTencentMeetingStrings();

    const meeting = history.find(m => m.id === id);

    if (!meeting) {
        return <div className="p-4">{s.meeting_detail_not_found}</div>;
    }

    const filteredParticipants = meeting.participants.filter(p =>
        p.name.toLowerCase().includes(searchText.toLowerCase())
    );
    const attendeesTitle = formatAttendeesPageTitle(s.attendees_page_title_with_count, meeting.participants.length);

    return (
        <div className="flex flex-col h-full bg-app-surface text-black">
            {/* Header */}
            <div className="pt-10 bg-app-surface">
                <div className="grid grid-cols-[40px,minmax(0,1fr),40px] items-center gap-2 px-4 pb-3">
                    <button {...bindBack()} className="p-2 -ml-2 active:opacity-50 justify-self-start">
                        <IcNavBack size={24} className="text-black" />
                    </button>
                    <span className="min-w-0 truncate text-center text-[17px] font-bold text-black">
                        {attendeesTitle}
                    </span>
                    <button className="p-2 -mr-2 justify-self-end">
                        <IcDownload size={24} className="text-black" />
                    </button>
                </div>
            </div>

            {/* IcSearch */}
            <div className="px-4 py-2">
                <div className="bg-[#F5F5F5] h-9 rounded-lg flex min-w-0 items-center px-3">
                    <IcSearch size={16} className="text-gray-400 mr-2 shrink-0" />
                    <input
                        placeholder={s.attendees_search_placeholder}
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none text-gray-900 placeholder-gray-400"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {filteredParticipants.map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">
                        <div className="w-10 h-10 rounded-full bg-blue-600 overflow-hidden flex items-center justify-center shrink-0">
                            {p.avatar ? (
                                <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-white text-sm font-medium">{p.name.slice(0, 2)}</span>
                            )}
                        </div>
                        <div className="min-w-0 flex flex-col">
                            <span className="truncate text-base text-black">{p.name}</span>
                            {/* Check if host. In history, hostId is available. */}
                            {p.id === meeting.hostId && (
                                <span className="mt-0.5 truncate text-xs text-gray-400">{s.meeting_detail_organizer}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
