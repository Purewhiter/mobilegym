import React, { useState } from 'react';
import { IcNavBack, IcNavForward } from '../res/icons';
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { setPendingNewFavFolder } from './VideoDetailPage';

export const CreateFavFolderPage: React.FC = () => {
  const { bindBack, back } = useBilibiliGestures();
  const createFavFolder = useBilibiliStore(s => s.createFavFolder);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const canSubmit = name.trim().length > 0;

  const handleDone = () => {
    if (!canSubmit) return;
    const newId = createFavFolder(name.trim(), description.trim() || undefined, isPublic);
    setPendingNewFavFolder(newId);
    back();
  };

  return (
    <div className="flex flex-col h-full bg-white pt-10" data-status-bar-foreground="dark">
      {/* header */}
      <div className="flex items-center justify-between px-4 h-12 shrink-0">
        <button {...bindBack()} className="w-8 h-8 flex items-center justify-center active:opacity-60">
          <IcNavBack size={22} />
        </button>
        <span className="text-[17px] font-medium">创建</span>
        <button
          className={`text-[15px] font-medium active:opacity-60 ${canSubmit ? 'text-gray-800' : 'text-gray-300'}`}
          onClick={handleDone}
          disabled={!canSubmit}
        >
          完成
        </button>
      </div>

      {/* form */}
      <div className="flex-1 px-4">
        {/* 封面 */}
        <div className="flex items-center justify-between py-4 border-b border-gray-100">
          <span className="text-[15px] text-gray-800">封面</span>
          <IcNavForward size={18} className="text-gray-400" />
        </div>

        {/* 名称 */}
        <div className="flex items-center gap-3 py-4 border-b border-gray-100">
          <span className="text-[15px] text-gray-800 shrink-0">
            名称<span className="text-app-primary">*</span>
          </span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="名称"
            maxLength={20}
            className="flex-1 text-[15px] text-gray-800 placeholder:text-gray-300 outline-none bg-transparent"
          />
        </div>

        {/* 简介 */}
        <div className="flex items-center gap-3 py-4 border-b border-gray-100">
          <span className="text-[15px] text-gray-800 shrink-0">简介</span>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="可填写简介"
            maxLength={200}
            className="flex-1 text-[15px] text-gray-800 placeholder:text-gray-300 outline-none bg-transparent"
          />
        </div>

        <div className="h-px bg-gray-50 my-6" />

        {/* 公开 toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[15px] text-gray-800">公开</span>
          <button
            className={`relative w-12 h-7 rounded-full transition-colors ${isPublic ? 'bg-app-primary' : 'bg-gray-300'}`}
            onClick={() => setIsPublic(!isPublic)}
          >
            <div
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform"
              style={{ transform: isPublic ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
