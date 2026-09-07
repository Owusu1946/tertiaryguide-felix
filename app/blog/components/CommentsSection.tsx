
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { CommentItem, BlogComment } from "./CommentItem";
import Image from "next/image";
import { MessageSquare, SendHorizontal, Loader2 } from "lucide-react";

interface CommentsSectionProps {
    postId: string;
}

export function CommentsSection({ postId }: CommentsSectionProps) {
    const [comments, setComments] = useState<BlogComment[]>([]);
    const [newCommentText, setNewCommentText] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
    const [currentUserName, setCurrentUserName] = useState<string>("User");
    const [currentUserAvatar, setCurrentUserAvatar] = useState<string>("/woman.png");

    // Load current user from localStorage
    useEffect(() => {
        const loadUserData = () => {
            const email = localStorage.getItem("tg_user_email");
            const name = localStorage.getItem("tg_user_name");
            const avatar = localStorage.getItem("tg_user_avatar");

            setCurrentUserEmail(email);
            if (name) setCurrentUserName(name);
            if (avatar) setCurrentUserAvatar(avatar);
        };

        loadUserData();

        window.addEventListener("tg-profile-updated", loadUserData);
        window.addEventListener("tg_user_name_updated", loadUserData);

        return () => {
            window.removeEventListener("tg-profile-updated", loadUserData);
            window.removeEventListener("tg_user_name_updated", loadUserData);
        };
    }, []);

    const fetchComments = useCallback(async (isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            const res = await fetch(`/api/blog/comments?postId=${postId}`);
            const data = await res.json();
            if (data.ok) {
                setComments(data.comments);
            }
        } catch (error) {
            console.error("Failed to fetch comments", error);
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    const handlePostComment = async (parentId: string | null = null, text: string) => {
        if (!currentUserEmail) {
            alert("Please sign in to comment.");
            return;
        }

        // Optimistic Update
        const tempId = "optimistic-" + Date.now();
        const optimisticComment: BlogComment = {
            _id: tempId,
            postId,
            parentId,
            userEmail: currentUserEmail,
            userName: currentUserName,
            userAvatar: currentUserAvatar,
            text,
            likes: [],
            createdAt: new Date().toISOString(),
        };

        setComments(prev => [...prev, optimisticComment]);

        try {
            const res = await fetch("/api/blog/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    postId,
                    parentId,
                    userEmail: currentUserEmail,
                    userName: currentUserName,
                    userAvatar: currentUserAvatar,
                    text,
                }),
            });

            const data = await res.json();
            if (data.ok) {
                setComments(prev => prev.map(c => c._id === tempId ? data.comment : c));
            } else {
                setComments(prev => prev.filter(c => c._id !== tempId));
                alert("Failed to post comment.");
            }
        } catch (error) {
            console.error("Post comment error", error);
            setComments(prev => prev.filter(c => c._id !== tempId));
        }
    };

    const handleLike = async (commentId: string) => {
        if (!currentUserEmail) {
            alert("Please sign in to like.");
            return;
        }

        // Optimistic Update
        setComments(prev => prev.map(c => {
            if (c._id === commentId) {
                const hasLiked = c.likes.includes(currentUserEmail);
                return {
                    ...c,
                    likes: hasLiked
                        ? c.likes.filter(email => email !== currentUserEmail)
                        : [...c.likes, currentUserEmail]
                };
            }
            return c;
        }));

        try {
            const res = await fetch("/api/blog/comments/like", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ commentId, userEmail: currentUserEmail }),
            });
            const data = await res.json();
            if (!data.ok) {
                await fetchComments(true); // Sync back
            }
        } catch (error) {
            console.error("Like toggle error", error);
            await fetchComments(true);
        }
    };

    const topLevelComments = comments.filter(c => !c.parentId);

    return (
        <section className="mt-16 border-t border-gray-100 pt-10">
            <div className="flex items-center gap-2 mb-8">
                <MessageSquare className="text-[#007AFF] h-5 w-5" />
                <h2 className="text-xl font-bold text-[#1E1E1E]">
                    Comments {comments.length > 0 && `(${comments.length})`}
                </h2>
            </div>

            {/* Post Input */}
            <div className="mb-10 flex gap-3">
                <div className="relative h-10 w-10 flex-shrink-0">
                    <Image
                        src={currentUserAvatar}
                        alt="You"
                        fill
                        unoptimized
                        className="rounded-full border border-gray-100 object-cover"
                    />
                </div>
                <div className="flex-1">
                    <div className="relative">
                        <textarea
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="Write a comment..."
                            disabled={submitting}
                            className="w-full rounded-3xl border-none bg-[#F0F2F5] px-5 py-3 pr-12 text-[15px] outline-none transition-shadow focus:ring-1 focus:ring-gray-200"
                            rows={1}
                            style={{ height: 'auto', minHeight: '48px' }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    if (newCommentText.trim()) {
                                        setSubmitting(true);
                                        handlePostComment(null, newCommentText).finally(() => {
                                            setSubmitting(false);
                                            setNewCommentText("");
                                        });
                                    }
                                }
                            }}
                        />
                        <button
                            type="button"
                            disabled={submitting || !newCommentText.trim()}
                            onClick={() => {
                                if (newCommentText.trim()) {
                                    setSubmitting(true);
                                    handlePostComment(null, newCommentText).finally(() => {
                                        setSubmitting(false);
                                        setNewCommentText("");
                                    });
                                }
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full text-[#007AFF] hover:bg-gray-200 transition-colors disabled:opacity-30"
                        >
                            {submitting ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <SendHorizontal className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                    <p className="mt-2 text-[11px] text-[#65676B] px-2 italic">
                        Press Enter to post
                    </p>
                </div>
            </div>

            {/* Comments List */}
            {loading ? (
                <div className="space-y-6">
                    {[1, 2].map((i) => (
                        <div key={i} className="flex gap-3 animate-pulse">
                            <div className="h-9 w-9 rounded-full bg-gray-100" />
                            <div className="flex-1 space-y-2">
                                <div className="h-10 rounded-2xl bg-gray-100 w-3/4" />
                                <div className="h-3 rounded bg-gray-100 w-24 ml-2" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : topLevelComments.length > 0 ? (
                <div className="space-y-8">
                    {topLevelComments.map((comment) => (
                        <CommentItem
                            key={comment._id}
                            comment={comment}
                            allComments={comments}
                            onReply={handlePostComment}
                            onLike={handleLike}
                            currentUserEmail={currentUserEmail}
                            currentAvatar={currentUserAvatar}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                    <div className="bg-gray-100 p-4 rounded-full mb-3">
                        <MessageSquare size={32} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">No comments yet. Be the first to join the conversation!</p>
                </div>
            )}
        </section>
    );
}
