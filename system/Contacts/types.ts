export type ContactId = string;

export interface ContactPhone {
  id: string;
  label: string; // e.g. 手机/住宅/公司
  number: string;
  isPrimary?: boolean;
}

export interface ContactEmail {
  id: string;
  label: string;
  email: string;
  isPrimary?: boolean;
}

export interface Contact {
  id: ContactId;
  displayName: string;

  /** Optional sort key (e.g. pinyin/latin) for stable UI grouping */
  sortKey?: string;
  /** Optional section key shown in the right index (A-Z or '#') */
  sectionKey?: string;

  avatarColor?: string;
  avatarUri?: string;

  starred?: boolean;
  lastContactedAt?: number;

  phones: ContactPhone[];
  emails?: ContactEmail[];

  company?: string;
  title?: string;
  notes?: string;

  createdAt?: number;
  updatedAt?: number;
}

