// src/main/java/com/homecook/ai_recipe/repo/FavoriteRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.Favorite;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    // 기존 (호환)
    List<Favorite> findAllByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<Favorite> findByUserIdAndRecipeId(Long userId, Long recipeId);
    long countByUserId(Long userId);
    void deleteByUserIdAndRecipeId(Long userId, Long recipeId);
    boolean existsByUserIdAndRecipeId(Long userId, Long recipeId);

    // provider 포함 CRUD
    List<Favorite> findAllByUserIdAndProviderOrderByCreatedAtDesc(Long userId, String provider);
    Optional<Favorite> findByUserIdAndProviderAndRecipeId(Long userId, String provider, Long recipeId);
    long countByUserIdAndProvider(Long userId, String provider);
    void deleteByUserIdAndProviderAndRecipeId(Long userId, String provider, Long recipeId);
    boolean existsByUserIdAndProviderAndRecipeId(Long userId, String provider, Long recipeId);

    // ✅ 메타 포함 UPSERT: 새로 넣거나, 기존이 있으면 비어있는 칼럼만 채움
    @Modifying
    @Query(value = """
        INSERT INTO favorite(user_id, provider, recipe_id, title, summary, image, meta, created_at)
        VALUES (:uid, :provider, :rid, :title, :summary, :image, :meta, now())
        ON CONFLICT (user_id, provider, recipe_id)
        DO UPDATE SET
            title   = COALESCE(NULLIF(EXCLUDED.title,''),   favorite.title),
            summary = COALESCE(NULLIF(EXCLUDED.summary,''), favorite.summary),
            image   = COALESCE(NULLIF(EXCLUDED.image,''),   favorite.image),
            meta    = COALESCE(NULLIF(EXCLUDED.meta,''),    favorite.meta)
        """, nativeQuery = true)
    void upsertWithMeta(@Param("uid") Long userId,
                        @Param("provider") String provider,
                        @Param("rid") Long recipeId,
                        @Param("title") String title,
                        @Param("summary") String summary,
                        @Param("image") String image,
                        @Param("meta") String meta);
}
