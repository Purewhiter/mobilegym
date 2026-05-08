const ARTIST_NAMES_EN: Record<string, string> = {
  '周杰伦': 'Jay Chou',
  '林俊杰': 'JJ Lin',
  '许嵩': 'Xu Song',
  '胡66': 'Hu 66',
  '陶喆': 'David Tao',
  '方大同': 'Khalil Fong',
  '姜涛': 'Keung To',
  '邓紫棋': 'G.E.M.',
  '鄧紫棋': 'G.E.M.',
  '林忆莲': 'Sandy Lam',
  '薛之谦': 'Joker Xue',
  '陈奕迅': 'Eason Chan',
  '陳奕迅': 'Eason Chan',
  '孙燕姿': 'Stefanie Sun',
  '孫燕姿': 'Stefanie Sun',
  '房东的猫': "Landlord's Cat",
  '告五人': 'Accusefive',
  '落日飞车': 'Sunset Rollercoaster',
  '陈粒': 'Chen Li',
  '楊丞琳': 'Rainie Yang',
  '杨丞琳': 'Rainie Yang',
  '林宥嘉': 'Yoga Lin',
  '盧廣仲': 'Crowd Lu',
  '卢广仲': 'Crowd Lu',
  '周興哲': 'Eric Chou',
  '周兴哲': 'Eric Chou',
  '蔡健雅': 'Tanya Chua',
  '李聖傑': 'Sam Lee',
  '韋禮安': 'WeiBird',
  '莫文蔚': 'Karen Mok',
  '汪蘇瀧': 'Silence Wang',
  '汪苏泷': 'Silence Wang',
  '陳華': 'Chen Hua',
  '陈华': 'Chen Hua',
  '胡彦斌': 'Tiger Hu',
  '王心凌': 'Cyndi Wang',
  '张芸京': 'Zhang Yun-jing',
  '黄程晗': 'Hayden Huang',
  '方立维': 'Fong Lap Wai',
  '宇多田光': 'Hikaru Utada',
  '张惠妹': 'A-Mei',
  '蕭敬腾': 'Jam Hsiao',
  '萧敬腾': 'Jam Hsiao',
  '陈零九': 'Chen Lingjiu',
  '周深': 'Zhou Shen',
  '张杰': 'Jason Zhang',
  '张杰 ': 'Jason Zhang',
  '李荣浩': 'Li Ronghao',
  '李榮浩': 'Li Ronghao',
  '王铮亮': 'Wang Zhengliang',
  '刘宇宁': 'Liu Yuning',
  '陆虎': 'Lu Hu',
  '谭维维': 'Sitar Tan',
  '李琦': 'Li Qi',
  '杨坤': 'Yang Kun',
};

const EXACT_TEXT_EN: Record<string, string> = {
  '搁浅': 'Stranded',
  '修炼爱情': 'Practice Love',
  '有何不可': 'Why Not',
  '青花瓷': 'Blue and White Porcelain',
  '稻香': 'Rice Aroma',
  '晴天': 'Sunny Day',
  '后来遇见他': 'Met Him Later',
  '爱我还是他': 'Love Me or Him',
  '爱爱爱': 'Love Love Love',
  '用背脊唱情歌': 'Sing Love Songs With My Back',
  '你要倔强': 'Stay Stubborn',
  '华语R&B精选': 'Mandopop R&B Essentials',
  '華語R&B精選': 'Mandopop R&B Essentials',
  '轻声摇滚': 'Soft Rock',
  '夜幕City Pop': 'Nightfall City Pop',
  '公路旅行': 'Road Trip',
  '有何不可 电台': 'Why Not Radio',
  '新的心跳': 'New Heartbeat',
  '雨爱': 'Rain Love',
  '2010年代 華語最流行': '2010s Mandopop Hits',
  '經典傳唱': 'Timeless Classics',
  '暖': 'Warmth',
  '十年全精選: 華語流行': 'Decade Essentials: Mandopop',
  '情歌不敗': 'Timeless Love Songs',
  '獨特嗓音': 'Distinctive Voices',
  '最Hit粤语榜': 'Cantonese Hits',
  '2000年代华语金曲': '2000s Mandopop Gold',
  '还好有你': 'Glad I Have You',
  '灵魂共振': 'Soul Resonance',
  '高人气金曲': 'Popular Hits',
  '新歌热播': 'New Song Hits',
  '听台湾 Team TAIWAN': 'Hear Taiwan: Team TAIWAN',
  '我爱K歌': 'I Love Karaoke',
  '艺人': 'Artist',
  '与相似的更多艺人': 'More like this artist',
  '每日更新的热门曲目': 'Daily updated popular tracks',
  '粤语流行精选': 'Cantonese pop essentials',
  '飙升最快的歌曲': 'Fastest-rising tracks',
  '每周最热单曲': 'Hottest singles this week',
  '摇滚女声': 'Rock diva',
  '全能制作人': 'All-round producer',
  '甜蜜情歌': 'Sweet love songs',
  'K-Pop醒神歌单': 'K-Pop wake-up playlist',
};

export function localizeSpotifyText(value: string | undefined, isEnglish: boolean): string {
  if (!value) return '';
  if (!isEnglish) return value;

  const exact = EXACT_TEXT_EN[value];
  if (exact) return exact;

  let localized = value;
  for (const [source, target] of Object.entries(ARTIST_NAMES_EN)) {
    localized = localized.replaceAll(source, target);
  }

  return localized
    .replaceAll('、', ', ')
    .replaceAll('，', ', ')
    .replaceAll('／', '/');
}

export function localizeSpotifyArtistName(name: string | undefined, isEnglish: boolean): string {
  return localizeSpotifyText(name, isEnglish);
}
