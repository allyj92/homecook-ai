// src/main/java/com/homecook/ai_recipe/repo/FavoriteRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.Favorite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {
    List<Favorite> findAllByUser_IdOrderByCreatedAtDesc(Long userId);
    boolean existsByUser_IdAndRecipeId(Long userId, Long recipeId);
    Optional<Favorite> findByUser_IdAndRecipeId(Long userId, Long recipeId);
}
