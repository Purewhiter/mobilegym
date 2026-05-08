/**
 * AnswerSheet 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  // App
  app_name: '答题卡',

  // Page title
  default_question: '请回答以下问题',

  // Field placeholders
  placeholder_number: '请输入数字',
  placeholder_text: '请输入',
  placeholder_select: '请选择',

  // Repeatable
  add_item: '➕ 添加一项',

  // Submit
  btn_submit: '提交答案',
  btn_modify: '修改答案',
  submitted_label: '答案已提交',

  // Empty state
  empty_title: '暂无题目',
  empty_hint: '等待任务分配…',
} as const;

export type StringKey = keyof typeof strings;
