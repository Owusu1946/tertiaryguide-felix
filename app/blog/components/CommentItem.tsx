
"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ThumbsUp, MessageSquare, Reply, SendHorizontal, Loader2, ChevronDown, ChevronUp } from "lucide-react";

export type BlogComment = {
    _id: string;
    postId: string;
    parentId: string | null;
    userEmail: string;
    userName: string;
    userAvatar: string;
    text: string;
    likes: string[];
    createdAt: string;
};

interface CommentItemProps {
    comment: BlogComment;
    allComments: BlogComment[];
    onReply: (parentId: string, text: string) => Promise<void>;
    onLike: (commentId: string) => Promise<void>;
    currentUserEmail: string | null;
    currentAvatar: string;
}

export function CommentItem({ comment, allComments, onReply, onLike, currentUserEmail, currentAvatar }: CommentItemProps) {
    const [isReplying, setIsReplying] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const replies = allComments.filter(c => c.parentId === comment._id);
    const hasLiked = currentUserEmail ? comment.likes.includes(currentUserEmail) : false;

    const handleSubmitReply = async () => {
        if (!replyText.trim() || submitting) return;
        setSubmitting(true);
        try {
            await onReply(comment._id, replyText);
            setReplyText("");
            setIsReplying(false);
            setIsExpanded(true); // Auto-expand to show the new reply
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="group animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex gap-3">
                {/* Avatar */}
                <div className="relative h-9 w-9 flex-shrink-0">
                    <Image
                        src={comment.userAvatar || "/woman.png"}
                        alt={comment.userName}
                        fill
                        unoptimized
                        className="rounded-full border border-gray-100 object-cover shadow-sm"
                    />
                </div>

                {/* Bubble Container */}
                <div className="flex-1 space-y-1">
                    <div className="inline-block max-w-full rounded-2xl bg-[#F0F2F5] px-4 py-2 hover:bg-[#E4E6E9] transition-colors">
                        <p className="text-[13px] font-bold leading-none text-[#050505]">
                            {comment.userName}
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-snug text-[#050505]">
                            {comment.text}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4 px-2 text-[12px] font-bold text-[#65676B]">
                        <button
                            onClick={() => onLike(comment._id)}
                            className={`hover:underline ${hasLiked ? "text-[#007AFF]" : ""}`}
                        >
                            {hasLiked ? "Liked" : "Like"}
                        </button>
                        <button
                            onClick={() => setIsReplying(!isReplying)}
                            className="hover:underline"
                        >
                            Reply
                        </button>
                        <span className="font-normal text-[#8A8D91]">
                            {new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>

                        {comment.likes.length > 0 && (
                            <div className="flex items-center gap-1 ml-auto">
                                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#007AFF] text-white">
                                    <ThumbsUp size={10} fill="currentColor" />
                                </div>
                                <span className="font-normal tabular-nums">{comment.likes.length}</span>
                            </div>
                        )}
                    </div>

                    {/* View Replies Button */}
                    {replies.length > 0 && !isExpanded && (
                        <button
                            onClick={() => setIsExpanded(true)}
                            className="flex items-center gap-2 mt-2 text-[13px] font-bold text-[#65676B] hover:underline"
                        >
                            <div className="flex -space-x-1">
                                {replies.slice(0, 2).map((r, i) => (
                                    <div key={r._id} className="relative h-4 w-4 rounded-full border border-white overflow-hidden bg-gray-200">
                                        <Image src={r.userAvatar || "/woman.png"} fill unoptimized alt="" className="object-cover" />
                                    </div>
                                ))}
                            </div>
                            <span>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
                        </button>
                    )}

                    {/* Reply Input */}
                    {isReplying && (
                        <div className="mt-2 flex gap-2 animate-in zoom-in-95 duration-200">
                            <div className="relative h-7 w-7 flex-shrink-0">
                                <Image
                                    src={currentAvatar}
                                    alt="You"
                                    fill
                                    unoptimized
                                    className="rounded-full object-cover shadow-sm border border-gray-100"
                                />
                            </div>
                            <div className="relative flex-1">
                                <textarea
                                    autoFocus
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder={`Reply to ${comment.userName}...`}
                                    disabled={submitting}
                                    className="w-full rounded-2xl border-none bg-[#F0F2F5] px-4 py-2 pr-10 text-[14px] outline-none focus:ring-0"
                                    rows={1}
                                    style={{ height: 'auto', minHeight: '36px' }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmitReply();
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleSubmitReply}
                                    disabled={submitting || !replyText.trim()}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-[#007AFF] hover:bg-gray-200 transition-colors disabled:opacity-30"
                                >
                                    {submitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <SendHorizontal className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Nested Replies */}
                    {replies.length > 0 && isExpanded && (
                        <div className="mt-2">
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="text-[13px] font-bold text-[#65676B] hover:underline mb-3 ml-2"
                            >
                                Hide replies
                            </button>
                            <div className="space-y-5 border-l-2 border-[#E4E6E9] pl-4 ml-1">
                                {replies.map((reply) => (
                                    <CommentItem
                                        key={reply._id}
                                        comment={reply}
                                        allComments={allComments}
                                        onReply={onReply}
                                        onLike={onLike}
                                        currentUserEmail={currentUserEmail}
                                        currentAvatar={currentAvatar}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
