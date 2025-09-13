package com.homecook.ai_recipe.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreatePostReq(
        @NotBlank @Size(min = 1, max = 120) String title,
        @NotBlank @Size(min = 1, max = 40)  String category,
        @NotBlank                           String content,
        List<String> tags,
        String youtubeUrl,   // ← 추가
        String repImageUrl   // ← 추가
) {}