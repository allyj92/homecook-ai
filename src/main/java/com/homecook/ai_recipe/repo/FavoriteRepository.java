// src/main/java/com/homecook/ai_recipe/repo/FavoriteRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.Favorite;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Repository
public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    // ✅ 파생쿼리 대신 JPQL을 “명시적으로” 적어 에러 근원을 차단
    @Query("select f from Favorite f where f.user.id = :userId order by f.createdAt desc")
    List<Favorite> findByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);

    // ✅ 연관 필드 경로는 반드시 언더스코어 사용 (user_id → user.id)
    boolean existsByUser_IdAndRecipeId(Long userId, Long recipeId);

    Optional<Favorite> findByUser_IdAndRecipeId(Long userId, Long recipeId);

    @Modifying
    @Transactional
    @Query("delete from Favorite f where f.user.id = :userId and f.recipeId = :recipeId")
    int deleteByUserIdAndRecipeId(@Param("userId") Long userId, @Param("recipeId") Long recipeId);
}
