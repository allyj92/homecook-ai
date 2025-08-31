// src/main/java/com/homecook/ai_recipe/repo/FavoriteRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.Favorite;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    // 목록: user.id 기준 정렬
    @Query("select f from Favorite f where f.user.id = :userId order by f.createdAt desc")
    List<Favorite> findByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);

    // ✅ 서비스에서 사용하는 네이밍으로 통일(언더스코어 포함)
    boolean existsByUser_IdAndRecipeId(Long userId, Long recipeId);

    Optional<Favorite> findByUser_IdAndRecipeId(Long userId, Long recipeId);

    // 삭제(JPQL)
    @Transactional
    @Modifying
    @Query("delete from Favorite f where f.user.id = :userId and f.recipeId = :recipeId")
    int deleteByUserIdAndRecipeId(@Param("userId") Long userId, @Param("recipeId") Long recipeId);

    /* ---- (선택) 메타 조인 프로젝션 (페이지/미리보기) ---- */
    interface FavoriteWithMetaRow {
        Long getId();
        Long getRecipeId();
        LocalDateTime getCreatedAt();
        String getTitle();
        String getSummary();
        String getImage();
        String getMeta();
    }

    @Query(value = """
        select f.id,
               f.recipe_id  as recipeId,
               f.created_at as createdAt,
               f.title      as title,
               f.summary    as summary,
               f.image      as image,
               f.meta       as meta
          from favorite f
         where f.user_id = :userId
         order by f.created_at desc
         limit :limit
        """, nativeQuery = true)
    List<FavoriteWithMetaRow> findTopWithMeta(@Param("userId") Long userId, @Param("limit") int limit);

    @Query(value = """
        select f.id,
               f.recipe_id  as recipeId,
               f.created_at as createdAt,
               f.title      as title,
               f.summary    as summary,
               f.image      as image,
               f.meta       as meta
          from favorite f
         where f.user_id = :userId
         order by f.created_at desc
        """,
            countQuery = "select count(*) from favorite f where f.user_id = :userId",
            nativeQuery = true)
    Page<FavoriteWithMetaRow> findPageWithMeta(@Param("userId") Long userId, Pageable pageable);
}
