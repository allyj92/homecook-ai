// src/main/java/com/homecook/ai_recipe/repo/FavoriteRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.Favorite;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    // 목록
    List<Favorite> findByUser_IdOrderByCreatedAtDesc(Long userId);

    // 존재여부
    boolean existsByUser_IdAndRecipeId(Long userId, Long recipeId);

    // 단건
    Optional<Favorite> findByUser_IdAndRecipeId(Long userId, Long recipeId);

    // 삭제
    long deleteByUser_IdAndRecipeId(Long userId, Long recipeId);
}
