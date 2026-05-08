import * as fs from 'fs';
import * as path from 'path';

// Define interface locally to avoid ts-node import issues
interface XPost {
  id: string;
  authorId: string;
  content: string;
  time: string;
  image?: string;
  video?: string;
  tweetUrl?: string;
  quotedPostId?: string;
  stats: {
    comments: number;
    retweets: number;
    likes: number;
    views: number;
  };
  threadId?: string;
  replies?: XPost[];
  author?: any;
}

const COMMENTS = [
  "This is amazing!",
  "Great work!",
  "I completely agree.",
  "Interesting perspective.",
  "Can you elaborate on that?",
  "Thanks for sharing.",
  "Wow, didn't know that.",
  "So true.",
  "Love this.",
  "Keep it up!",
  "First!",
  "This deserves more likes.",
  "Spot on.",
  "Exactly what I was thinking.",
  "Looking forward to more.",
  "Haha, nice one.",
  "Totally relatable.",
  "Good point.",
  "I learned something new today.",
  "Beautifully said."
];

const TIMES = ["1m", "5m", "15m", "1h", "2h", "5h", "1d", "2d"];

async function main() {
  // Use process.cwd() relative path since we run from root
  const dataPath = path.resolve(process.cwd(), 'apps/X/data/importedData.json');
  console.log(`Reading data from ${dataPath}...`);
  
  try {
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(rawData);
    
    const posts = data.importedPosts || [];
    const users = data.importedUsers || {};
    const userIds = Object.keys(users);
    
    console.log(`Found ${posts.length} posts and ${userIds.length} users.`);
    
    if (userIds.length === 0) {
      console.error("No users found to generate replies.");
      return;
    }

    const mockReplies: Record<string, XPost[]> = {};
    
    posts.forEach((post: any) => {
        const numReplies = Math.floor(Math.random() * 2) + 1;
        const postReplies: XPost[] = [];
        
        for (let i = 0; i < numReplies; i++) {
          const authorId = userIds[Math.floor(Math.random() * userIds.length)];
          const replyId = `r_${post.id}_${i}`;
          
          const hasNested = Math.random() > 0.95;
          const nestedReplies: XPost[] = [];
          
          if (hasNested) {
              const numNested = 1;
              for (let j=0; j<numNested; j++) {
                  const subAuthorId = userIds[Math.floor(Math.random() * userIds.length)];
                  nestedReplies.push({
                      id: `${replyId}_${j}`,
                      authorId: subAuthorId,
                      content: COMMENTS[Math.floor(Math.random() * COMMENTS.length)],
                      time: TIMES[Math.floor(Math.random() * TIMES.length)],
                      stats: {
                          comments: 0,
                          retweets: Math.floor(Math.random() * 5),
                          likes: Math.floor(Math.random() * 10),
                          views: Math.floor(Math.random() * 100)
                      },
                      replies: []
                  } as unknown as XPost);
              }
          }

          postReplies.push({
            id: replyId,
            authorId: authorId,
            content: COMMENTS[Math.floor(Math.random() * COMMENTS.length)],
            time: TIMES[Math.floor(Math.random() * TIMES.length)],
            stats: {
              comments: nestedReplies.length,
              retweets: Math.floor(Math.random() * 10),
              likes: Math.floor(Math.random() * 50),
              views: Math.floor(Math.random() * 500)
            },
            replies: nestedReplies
          } as unknown as XPost);
        }
        
        mockReplies[post.id] = postReplies;
    });
    
    const outputPath = path.resolve(process.cwd(), 'apps/X/data/repliesData.ts');
    const fileContent = `import { XPost } from './xTypes';

export const MOCK_REPLIES: Record<string, XPost[]> = ${JSON.stringify(mockReplies, null, 2)};
`;

    fs.writeFileSync(outputPath, fileContent);
    console.log(`Generated replies for ${Object.keys(mockReplies).length} posts at ${outputPath}`);
    
  } catch (error) {
    console.error("Error generating replies:", error);
  }
}

main();
