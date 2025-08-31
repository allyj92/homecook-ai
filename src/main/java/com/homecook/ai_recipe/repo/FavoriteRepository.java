package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.Favorite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    List<Favorite> findByUser_IdOrderByCreatedAtDesc(Long userId);
    boolean existsByUser_IdAndRecipeId(Long userId, Long recipeId);
    void deleteByUser_IdAndRecipeId(Long userId, Long recipeId);
}