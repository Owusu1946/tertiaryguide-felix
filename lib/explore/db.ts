import type { Db, Collection } from "mongodb";
import type { ExploreCommentDoc, ExplorePostDoc } from "./types";

export function explorePostsCollection(db: Db): Collection<ExplorePostDoc> {
  return db.collection<ExplorePostDoc>("explorePosts");
}

export function exploreCommentsCollection(
  db: Db,
): Collection<ExploreCommentDoc> {
  return db.collection<ExploreCommentDoc>("exploreComments");
}

export async function ensureExploreIndexes(db: Db) {
  const posts = explorePostsCollection(db);
  const comments = exploreCommentsCollection(db);

  await Promise.all([
    posts.createIndex({ status: 1, publishedAt: -1 }),
    posts.createIndex({ createdAt: -1 }),
    posts.createIndex({ postType: 1, status: 1 }),
    comments.createIndex({ postId: 1, createdAt: 1 }),
    comments.createIndex({ postId: 1, parentId: 1, createdAt: 1 }),
  ]);
}
