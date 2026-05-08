import likesIcon from './assets/message/list_1.jpg';
import followersIcon from './assets/message/list_2.jpg';
import commentsIcon from './assets/message/list_3.jpg';
import notificationsIcon from './assets/message/list_4.jpg';

export const REDBOOK_CONSTANTS = {
  messageIcons: {
    likes: likesIcon,
    followers: followersIcon,
    comments: commentsIcon,
    notifications: notificationsIcon,
  },
  useLocalData: false,
} as const;
