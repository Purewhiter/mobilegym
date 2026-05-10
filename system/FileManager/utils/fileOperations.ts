import type { FSNode } from '@/os/types';
import * as FileSystem from '@/os/FileSystemService';

export type TransferOperation = 'copy' | 'move';

export async function transferNodesToDirectory(
  nodes: FSNode[],
  destPath: string,
  operation: TransferOperation,
): Promise<boolean> {
  if (nodes.length === 0) return false;

  try {
    for (const node of nodes) {
      const destNodePath = `${destPath}/${node.name}`;
      if (operation === 'move') {
        const moved = await FileSystem.moveNode(node.path, destNodePath);
        if (!moved) return false;
      } else {
        const copied = await copyNodeToPath(node, destNodePath);
        if (!copied) return false;
      }
    }
    return true;
  } catch (error) {
    console.error('[FileManager] Transfer failed:', error);
    return false;
  }
}

/**
 * Fire ACTION_SEND for image files in selection. Returns true if at least one
 * image was found and the intent was dispatched.
 *
 * 用 startActivity + newTask 走 fire-and-forget 语义（接收方如微信声明 launchMode='singleTask'
 * 时会留在自己 Task）。FileManager 不需要回执，与真机分享行为一致。
 */
export function shareNodesAsImages(nodes: FSNode[]): boolean {
  const imagePaths = nodes
    .filter((n) => n.type === 'file' && n.mimeType?.startsWith('image/'))
    .map((n) => n.path);
  if (imagePaths.length === 0) return false;
  window.__OS__?.startActivity?.(
    {
      action: 'ACTION_SEND',
      type: 'image/*',
      data: {
        stream: imagePaths.length === 1 ? imagePaths[0] : imagePaths,
        mimeType: 'image/jpeg',
      },
    },
    { newTask: true },
  );
  return true;
}

async function copyNodeToPath(node: FSNode, destPath: string): Promise<boolean> {
  if (node.type === 'file') {
    const copied = await FileSystem.copyFile(node.path, destPath);
    return Boolean(copied);
  }

  await FileSystem.createDirectory(destPath);
  const children = FileSystem.listDirectory(node.path);
  for (const child of children) {
    const copied = await copyNodeToPath(child, `${destPath}/${child.name}`);
    if (!copied) return false;
  }
  return true;
}
