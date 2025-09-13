package com.homecook.ai_recipe.dto;

import java.time.LocalDateTime;
import java.util.List;


public record PostRes(
        Long id,
        String title,
        String category,
        String content,
        List<String> tags,
        Long authorId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String youtubeId,     // ✅ DB에 저장된 videoId
        String repImageUrl    // ✅ 대표 이미지
) {}