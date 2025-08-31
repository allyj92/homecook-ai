package com.homecook.ai_recipe.dto;

public record FavoriteDto(
        Long id,
        Long recipeId,
        String title,
        String summary,
        String image,
        String meta,
        String createdAt // ISO_LOCAL_DATE_TIME
) {}