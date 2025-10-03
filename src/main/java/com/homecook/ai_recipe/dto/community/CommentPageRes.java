package com.homecook.ai_recipe.dto.community;

import java.util.List;

public record CommentPageRes(
        List<CommentRes> items,
        Long nextCursor,
        Long total
) {}
