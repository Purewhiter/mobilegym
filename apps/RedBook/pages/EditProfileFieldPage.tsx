import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { IcNavBack } from '../res/icons';
import { useRedBookStore } from '../state';
import { useRedBookStrings } from '../hooks/useRedBookStrings';
import { useRedBookGestures } from '../hooks/useRedBookGestures';

/** The profile fields edited on their own page, as the real app does ("编辑名字"). */
export const EDITABLE_PROFILE_FIELDS = ['name', 'intro', 'birthday', 'address', 'job', 'school'] as const;
export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];

const MAX_LENGTH: Record<EditableProfileField, number> = {
  name: 24, intro: 100, birthday: 30, address: 30, job: 30, school: 30,
};

export const EditProfileFieldPage: React.FC = () => {
  const s = useRedBookStrings();
  const { field = 'name' } = useParams();
  const key = (EDITABLE_PROFILE_FIELDS as readonly string[]).includes(field) ? field as EditableProfileField : 'name';
  const { user, updateUser } = useRedBookStore(useShallow(st => ({ user: st.user, updateUser: st.updateUser })));
  const { bindBack, bindTap, back } = useRedBookGestures();

  const label = {
    name: s.name, intro: s.editprofilepage_bio, birthday: s.birthday,
    address: s.region, job: s.occupation, school: s.school,
  }[key];
  const current = String((user as unknown as Record<string, unknown>)[key] ?? '');
  const [value, setValue] = useState(current);
  const max = MAX_LENGTH[key];
  // Saving is offered once the value changed (a name cannot be emptied).
  const canSave = value !== current && (key !== 'name' || value.trim().length >= 2);

  const inputClass = 'w-full bg-transparent text-[16px] text-app-text outline-none';
  return (
    <div className="h-full flex flex-col bg-[#f4f4f4] pt-10">
      <div className="h-12 px-4 flex items-center justify-between">
        <div className="w-14 active:opacity-60" {...bindBack()}>
          <IcNavBack size={24} className="text-app-text" />
        </div>
        <span className="text-[17px] font-medium text-app-text">{s.edit_title_prefix}{label}</span>
        <span
          className={`w-14 text-right text-[16px] ${canSave ? 'text-[#ff2442]' : 'text-[#ff2442]/40'}`}
          {...(canSave ? bindTap({ kind: 'action', id: 'redbook.editProfile.field.save' }, {
            params: { field: key },
            onTrigger: () => {
              updateUser({ [key]: value.trim() });
              back();
            },
          }) : {})}
        >
          {s.save}
        </span>
      </div>

      <div className="mx-4 mt-3 rounded-2xl bg-app-surface px-5 py-4 flex items-start gap-3">
        {key === 'intro' ? (
          <textarea
            className={`${inputClass} h-28 resize-none`}
            value={value}
            maxLength={max}
            autoFocus
            onChange={e => setValue(e.target.value)}
          />
        ) : (
          <input className={inputClass} value={value} maxLength={max} autoFocus onChange={e => setValue(e.target.value)} />
        )}
        <span className="shrink-0 text-[13px] text-app-text-muted">{value.length}/{max}</span>
      </div>

      {key === 'name' ? <div className="mx-6 mt-3 text-[14px] leading-relaxed text-app-text-muted">{s.name_rule}</div> : null}
    </div>
  );
};

export default EditProfileFieldPage;
