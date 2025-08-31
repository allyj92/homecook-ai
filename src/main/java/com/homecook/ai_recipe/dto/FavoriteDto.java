// src/main/java/com/homecook/ai_recipe/dto/FavoriteDto.java
package com.homecook.ai_recipe.dto;

public record FavoriteDto(
        Long id,
        Long recipeId,
        String createdAt // ISO_LOCAL_DATE_TIME 문자열
) {}
