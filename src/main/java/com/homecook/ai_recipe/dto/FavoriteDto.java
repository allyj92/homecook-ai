// src/main/java/com/homecook/ai_recipe/dto/FavoriteDto.java
package com.homecook.ai_recipe.dto;

import java.time.LocalDateTime;

public record FavoriteDto(
        Long id,
        Long recipeId,
        String title,
        String summary,
        String image,
        String meta,
        LocalDateTime createdAt
) {}