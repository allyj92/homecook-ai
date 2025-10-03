package com.homecook.ai_recipe.dto.community;

public record CommentCreateReq(
        String content,
        Long parentId   // 대댓글 아니면 null
) {}