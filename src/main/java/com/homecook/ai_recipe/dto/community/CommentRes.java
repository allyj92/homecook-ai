package com.homecook.ai_recipe.dto.community;


import java.time.LocalDateTime;

public record CommentRes(
        Long id,
        Long postId,
        Long authorId,
        String authorName,
        String authorAvatar,
        String content,
        Boolean deleted,
        Long parentId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}