import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TWEETS_DIR = path.join(process.env.HOME, 'Desktop/tweets');
const OUTPUT_DIR = path.join(__dirname, '../data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'importedData.json');

// Helper to calculate time string (e.g. "5d")
const TODAY = new Date('2026-01-21'); // Based on environment date
function getTimeString(dateStr) {
    const date = new Date(dateStr);
    const diffTime = Math.abs(TODAY - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '今天';
    return `${diffDays}d`;
}

// Random stats generator
function getRandomStats(followers = 0) {
    const base = Math.max(10, Math.floor(followers / 100));
    return {
        comments: Math.floor(Math.random() * base),
        retweets: Math.floor(Math.random() * base * 2),
        likes: Math.floor(Math.random() * base * 5),
        views: Math.floor(Math.random() * base * 100)
    };
}

const BANNERS = [
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80',
    'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80',
    'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&q=80',
    'https://images.unsplash.com/photo-1519750783826-e2420f4d687f?w=800&q=80',
    'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80'
];

const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

function stripTrailingMediaTco(content, hasMedia) {
    const text = String(content ?? '');
    if (!hasMedia || !text.includes('https://t.co/')) {
        return text;
    }
    return text.replace(/(?:\s*)https:\/\/t\.co\/[A-Za-z0-9]+\s*$/u, '').trimEnd();
}

async function main() {
    if (!fs.existsSync(TWEETS_DIR)) {
        console.error(`Directory not found: ${TWEETS_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(TWEETS_DIR).filter(f => f.endsWith('.json'));
    const allUsers = {};
    const allPosts = [];
    const seenPostIds = new Set();
    const MAX_POSTS = 10; // Limit posts for testing log count

    console.log(`Found ${files.length} JSON files.`);

    // Sort files by date descending to get newest posts first
    files.sort().reverse();

    for (const file of files) {
        if (allPosts.length >= MAX_POSTS) break;

        const filePath = path.join(TWEETS_DIR, file);
        const dateStr = path.basename(file, '.json');
        const timeDisplay = getTimeString(dateStr);

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const tweets = JSON.parse(content);

            for (const tweet of tweets) {
                if (allPosts.length >= MAX_POSTS) break;

                // Map User
                const screenName = tweet.user && tweet.user.screenName;
                if (!screenName) continue;

                const userId = `u_${screenName.toLowerCase()}`;

                if (!allUsers[userId]) {
                    const joinYear = 2010 + Math.floor(Math.random() * 14);
                    const joinMonth = MONTHS[Math.floor(Math.random() * 12)];

                    allUsers[userId] = {
                        id: userId,
                        name: tweet.user.name,
                        handle: `@${screenName}`,
                        avatar: tweet.user.profileImageUrl ? tweet.user.profileImageUrl.replace('_normal', '') : undefined,
                        banner: BANNERS[Math.floor(Math.random() * BANNERS.length)],
                        verified: tweet.user.followersCount > 10000,
                        bio: tweet.user.description || '这个人很懒，什么都没有写。',
                        location: tweet.user.location || '互联网',
                        following: tweet.user.friendsCount,
                        followers: tweet.user.followersCount,
                        joinDate: `${joinYear}年${joinMonth}加入`
                    };
                }

                // Map Post
                let postId = `p_${Math.random().toString(36).substr(2, 9)}`;
                if (tweet.tweetUrl) {
                    const match = tweet.tweetUrl.match(/status\/(\d+)/);
                    if (match) postId = `p_${match[1]}`;
                }

                if (seenPostIds.has(postId)) continue;
                seenPostIds.add(postId);

                const isReply = tweet.fullText.startsWith('@');
                let replyTo = undefined;
                if (isReply) {
                    const match = tweet.fullText.match(/^@(\w+)/);
                    if (match) replyTo = match[1];
                }

                const image = tweet.images && tweet.images.length > 0 ? tweet.images[0] : undefined;
                const video = tweet.videos && tweet.videos.length > 0 ? tweet.videos[0] : undefined;

                const post = {
                    id: postId,
                    authorId: userId,
                    // 仅移除带媒体帖子末尾的占位短链，不影响正文中的真实外链。
                    content: stripTrailingMediaTco(tweet.fullText, Boolean(image || video)),
                    time: timeDisplay,
                    image,
                    video,
                    tweetUrl: tweet.tweetUrl,
                    stats: getRandomStats(tweet.user.followersCount),
                    replyTo: replyTo
                };

                allPosts.push(post);
            }
        } catch (err) {
            console.error(`Error processing file ${file}:`, err.message);
        }
    }

    // Determine users to follow (Top 50 most active in the dataset)
    const userActivity = {};
    allPosts.forEach(p => {
        userActivity[p.authorId] = (userActivity[p.authorId] || 0) + 1;
    });

    const topUsers = Object.keys(userActivity)
        .sort((a, b) => userActivity[b] - userActivity[a])
        .slice(0, 50);

    console.log(`Processed ${allPosts.length} posts and ${Object.keys(allUsers).length} users.`);

    // Generate JSON content
    const data = {
        importedUsers: allUsers,
        importedPosts: allPosts,
        suggestedFollowingIds: topUsers
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
    console.log(`Successfully wrote data to ${OUTPUT_FILE}`);
}

main();
