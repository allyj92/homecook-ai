package com.homecook.ai_recipe.repo;

// src/main/java/com/homecook/ai_recipe/repo/FavoriteRepository.java
public interface FavoriteWithMetaRow {
    Long getId();
    Long getRecipeId();
    java.time.LocalDateTime getCreatedAt();
    String getTitle();
    String getSummary();
    String getImage();
    String getMeta();
}
