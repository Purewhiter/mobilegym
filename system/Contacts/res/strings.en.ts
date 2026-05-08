import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  // Bottom tabs
  dialerIconLabel: 'Calls',
  contactsAllLabel: 'Contacts',
  businessHallLabel: 'Mobile Services',

  // Tabs / Title
  contactsList: 'Contacts',
  frequentList: 'Frequent',
  favoritesList: 'Favorites',

  // Search
  searchHint: 'Search contacts',
  searchSearching: 'Searching…',
  searchNoResults: 'No contacts found',
  clearSearchHistory: 'Clear search history',

  // Empty state
  contactsUnavailableAddAccount: 'Sign in to sync contacts',
  contactsUnavailableImportSimContacts: 'Import SIM contacts',
  contactsUnavailableImportFromOldDevice: 'Import from old device',
  contactsUnavailableImportContacts: 'Import vCard from storage',
  contactsUnavailableCreateContact: 'Create contact',

  // Common
  cancel: 'Cancel',
  done: 'Done',
  edit: 'Edit',
  delete: 'Delete',
  add: 'Add',

  // ContactsPage header & special entries
  contactsFilterAll: 'All contacts',
  bluetoothChat: 'Offline Chat',
  myCard: 'My Profile',
  myGroups: 'My Groups',
  scanBusinessCard: 'Scan business card',

  // SearchPage
  search_no_history: 'No search history',
  search_contacts_header: 'Contacts',

  // PhoneSettingsHomePage
  settings_contacts_title: 'Contacts settings',
  settings_calls_title: 'Phone settings',
  settings_opening: 'Opening settings…',

  // NewContactPage
  new_contact_title: 'New Mi Account Contact',
  new_contact_name_required: 'Please enter a name',
  new_contact_placeholder_name: 'Name',
  new_contact_placeholder_company: 'Company',
  new_contact_placeholder_job_title: 'Job title',
  new_contact_label_mobile: 'Mobile',
  new_contact_placeholder_phone: 'Phone',
  new_contact_label_work: 'Work',
  new_contact_placeholder_email: 'Email',
  new_contact_label_group: 'Group name',

  // ContactDetailPage
  contact_not_found: 'Contact does not exist',
  action_call: 'Call',
  action_sms: 'SMS',
  section_phones: 'Phone',
  section_email: 'Email',
  section_notes: 'Notes',
  section_call_logs: 'Call log',
  contact_no_call_logs: 'No call logs',
  contact_deleted_toast: 'Deleted',
  contact_delete_btn: 'Delete contact',

  // CallDetailPage
  call_detail_title: 'Call detail',
  call_log_not_found: 'Record does not exist',
  call_type_incoming: 'Incoming',
  call_type_outgoing: 'Outgoing',
  call_type_missed: 'Missed',
  call_type_normal: 'Call',

  // CallsPage header
  callFilterAll: 'All calls',

  // CallsPage
  call_official_badge: 'Official',
  sim_card_1: 'SIM 1',
  sim_card_2: 'SIM 2',

  // BusinessHallPage
  bh_data_remaining: 'Data remaining',
  bh_data_usage_analysis: 'Data usage analysis',
  bh_balance: 'Balance',
  bh_yuan_unit: ' CNY',
  bh_voice_used: 'Voice used',
  bh_minutes_unit: ' min',
  bh_greeting_prefix: '',
  bh_greeting_suffix: ' user',
  bh_recharge_title: 'Top up',
  bh_other_number_recharge: 'Top up another number',

  // PhonePreferenceScreenPage
  settings_selected: 'Selected',
};
