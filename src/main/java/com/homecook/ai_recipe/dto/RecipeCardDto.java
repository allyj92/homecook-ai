package com.homecook.ai_recipe.dto;

import java.time.Instant;

public record RecipeCardDto(
        Long id,
        String title,
        Instant createdAt,
        Integer likeCount,
        Integer commentCount,
        String repImageUrl
) {}