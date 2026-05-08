import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React, { useState } from 'react';
import { IcNavBack, IcNavForward, IcCamera } from '../res/icons';
const ChevronLeft = IcNavBack, ChevronRight = IcNavForward, Camera = IcCamera;
import { useRedBookStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useRedBookGestures } from '../hooks/useRedBookGestures';
export const EditProfilePage: React.FC = () => {
  const s = useRedBookStrings();
  const { user, updateUser } = useRedBookStore(useShallow(s => ({ user: s.user, updateUser: s.updateUser })));
  const { bindBack } = useRedBookGestures();
  const [showGenderModal, setShowGenderModal] = useState(false);

  const handleUpdate = (field: string, label: string, currentValue: string) => {
      const newValue = window.prompt(`${s.edit_field}${label}`, currentValue);
      if (newValue !== null && newValue !== currentValue) {
          updateUser({ [field]: newValue });
      }
  };

  const handleImageUpload = (type: 'avatar' | 'cover') => {
      const url = window.prompt(s.enter_new_image_url, type === 'avatar' ? user.avatar : (user.userCover || ''));
      if (url) {
          updateUser({ [type === 'avatar' ? 'avatar' : 'userCover']: url });
      }
  };

  const ListItem = ({
      label,
      value,
      placeholder,
      onClick,
      isLast = false,
      imagePreview
  }: {
      label: string,
      value?: string,
      placeholder?: string,
      onClick: () => void,
      isLast?: boolean,
      imagePreview?: string
  }) => (
      <div
        className={`flex items-center justify-between px-4 py-4 bg-app-surface active:bg-gray-50 ${!isLast ? 'border-b border-gray-50' : ''}`}
        onClick={onClick}
      >
          <span className="text-[15px] text-app-text">{label}</span>
          <div className="flex items-center gap-2">
              {imagePreview ? (
                   <div className="w-8 h-8 rounded bg-gray-200 overflow-hidden">
                       <img src={imagePreview} className="w-full h-full object-cover" />
                   </div>
              ) : (
                   <span className={`text-[15px] truncate max-w-[200px] text-right ${value ? 'text-app-text' : 'text-app-text-muted'}`}>
                      {value || placeholder}
                   </span>
              )}
              <ChevronRight size={18} className="text-[#ccc]" />
          </div>
      </div>
  );

  return (
    <div
      className="h-full flex flex-col bg-[#f8f8f8] overflow-y-auto relative"
      data-scroll-container="main"
      data-scroll-direction="vertical"
    >
      {/* Header */}
      <div className="pt-12 px-4 pb-3 flex items-center justify-between bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <span className="text-[17px] font-medium text-app-text">{s.edit_profile}</span>
        <span className="text-[15px] text-[#666] active:opacity-60 cursor-pointer">{s.preview}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-10">
          {/* Avatar Section */}
          <div className="flex justify-center py-8">
              <div
                className="relative w-[84px] h-[84px] rounded-full bg-gray-200 cursor-pointer active:opacity-90"
                onClick={() => handleImageUpload('avatar')}
              >
                  <img src={user.avatar} className="w-full h-full rounded-full object-cover" />
                  <div className="absolute bottom-0 right-0 bg-[#333] rounded-full p-1.5 border-2 border-white flex items-center justify-center">
                      <Camera size={12} className="text-white" />
                  </div>
              </div>
          </div>

          {/* Group 1 */}
          <div className="mx-3 bg-app-surface rounded-xl overflow-hidden mb-3">
              <ListItem
                label={s.name}
                value={user.name}
                onClick={() => handleUpdate('name', s.name, user.name)}
              />
              <ListItem
                label={s.rednote_id_3}
                value={user.id.replace('user_', '')}
                onClick={() => {}}
              />
              <ListItem
                label={s.cover_image}
                imagePreview={user.userCover || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100'}
                isLast
                onClick={() => handleImageUpload('cover')}
              />
          </div>

          {/* Group 2 */}
          <div className="mx-3 bg-app-surface rounded-xl overflow-hidden mb-3">
              <ListItem
                label={s.editprofilepage_bio}
                value={user.intro}
                placeholder={s.introduce_yourself}
                isLast
                onClick={() => handleUpdate('intro', s.editprofilepage_bio, user.intro || '')}
              />
          </div>

          {/* Group 3 */}
          <div className="mx-3 bg-app-surface rounded-xl overflow-hidden mb-3">
              <ListItem
                label={s.gender}
                value={user.gender === 'Male' ? s.male : s.female}
                onClick={() => setShowGenderModal(true)}
              />
              <ListItem
                label={s.birthday}
                value={user.birthday}
                placeholder={s.select_birthday}
                onClick={() => handleUpdate('birthday', s.birthday, user.birthday || '')}
              />
              <ListItem
                label={s.region}
                value={user.address}
                placeholder={s.select_region}
                onClick={() => handleUpdate('address', s.region, user.address || '')}
              />
              <ListItem
                label={s.occupation}
                value={(user as any).job}
                placeholder={s.select_occupation}
                onClick={() => handleUpdate('job', s.occupation, (user as any).job || '')}
              />
              <ListItem
                label={s.school}
                value={(user as any).school}
                placeholder={s.select_school}
                isLast
                onClick={() => handleUpdate('school', s.school, (user as any).school || '')}
              />
          </div>

          {/* Group 4 */}
          <div className="mx-3 bg-app-surface rounded-xl overflow-hidden mb-3">
              <ListItem
                label={s.original_content}
                value={s.not_verified_yet}
                isLast
                onClick={() => {}}
              />
          </div>
      </div>

      {/* Gender Selection Modal */}
      {showGenderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowGenderModal(false)}>
              <div className="bg-app-surface rounded-lg w-[70%] overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="py-4 text-center font-medium border-b border-gray-100">{s.select_gender}</div>
                  <div
                    className="py-3 text-center active:bg-gray-50 border-b border-gray-100"
                    onClick={() => { updateUser({ gender: 'Male' }); setShowGenderModal(false); }}
                  >
                      {s.male}
                  </div>
                  <div
                    className="py-3 text-center active:bg-gray-50"
                    onClick={() => { updateUser({ gender: 'Female' }); setShowGenderModal(false); }}
                  >
                      {s.female}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};