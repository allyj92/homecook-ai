package com.homecook.ai_recipe.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreatePostReq(
        @NotBlank @Size(min = 4, max = 120) String title,
        @NotBlank String category,
        @NotBlank @Size(min = 10) String content,
        List<String> tags
) {}