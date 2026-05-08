import { createAppStoreWithActions } from '../../os/createAppStore';
import type { AnswerSheetState, Field } from './types';

// ── 默认数据（演示用，正式运行时由 Runner 通过 set_state 注入） ──
const DEMO_FIELDS: Field[] = [
  {
    type: 'choice',
    label: '温差更大的城市',
    options: ['北京', '上海', '一样大'],
  },
  {
    type: 'number',
    label: '会议数量',
    hint: '请填写整数',
  },
  {
    type: 'text',
    label: '日期',
    hint: '如：周一',
    repeatable: true,
  },
];

const initialState: AnswerSheetState = {
  question: '北京和上海，明天哪个城市温差更大？一共有几场会议？哪几天有雨？',
  hint: '请根据查询结果填写以下信息',
  fields: DEMO_FIELDS,
  answers: {},
  submitted: false,
};

// ── Actions ──

interface AnswerSheetActions {
  setAnswer: (fieldIndex: number, value: string | string[]) => void;
  addRepeatableItem: (fieldIndex: number) => void;
  removeRepeatableItem: (fieldIndex: number, itemIndex: number) => void;
  updateRepeatableItem: (fieldIndex: number, itemIndex: number, value: string) => void;
  submit: () => void;
  unsubmit: () => void;
}

export const useAnswerSheetStore = createAppStoreWithActions<
  AnswerSheetState,
  AnswerSheetActions
>(
  'answer_sheet',
  initialState,
  (set) => ({
    setAnswer: (fieldIndex, value) => {
      set((state) => ({
        answers: { ...state.answers, [String(fieldIndex)]: value },
      }));
    },

    addRepeatableItem: (fieldIndex) => {
      set((state) => {
        const key = String(fieldIndex);
        const current = state.answers[key];
        const list = Array.isArray(current) ? [...current] : current ? [current] : [];
        list.push('');
        return { answers: { ...state.answers, [key]: list } };
      });
    },

    removeRepeatableItem: (fieldIndex, itemIndex) => {
      set((state) => {
        const key = String(fieldIndex);
        const current = state.answers[key];
        if (!Array.isArray(current)) return {};
        const list = current.filter((_, i) => i !== itemIndex);
        return { answers: { ...state.answers, [key]: list } };
      });
    },

    updateRepeatableItem: (fieldIndex, itemIndex, value) => {
      set((state) => {
        const key = String(fieldIndex);
        const current = state.answers[key];
        if (!Array.isArray(current)) return {};
        const list = [...current];
        list[itemIndex] = value;
        return { answers: { ...state.answers, [key]: list } };
      });
    },

    submit: () => {
      set({ submitted: true });
    },

    unsubmit: () => {
      set({ submitted: false });
    },
  }),
);
