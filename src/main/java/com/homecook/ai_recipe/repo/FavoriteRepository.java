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

    /* ===== 기본 즐겨찾기 조회/조작 ===== */

    // user.id 기준 정렬 조회 (JPQL)
    @Query("select f from Favorite f where f.user.id = :userId order by f.createdAt desc")
    List<Favorite> findByUser_IdOrderByCreatedAtDesc(@Param("userId") Long userId);

    // 존재 여부
    boolean existsByUser_IdAndRecipeId(Long userId, Long recipeId);

    // 단건 조회
    Optional<Favorite> findByUser_IdAndRecipeId(Long userId, Long recipeId);

    // 삭제 (user.id + recipeId)
    @Transactional
    @Modifying
    @Query("delete from Favorite f where f.user.id = :userId and f.recipeId = :recipeId")
    int deleteByUserIdAndRecipeId(@Param("userId") Long userId, @Param("recipeId") Long recipeId);


    /* ===== 메타(제목/요약/이미지) 조인 프로젝션 ===== */

    // favorite + wishlist_item 조인 결과를 담을 Projection
    interface FavoriteWithMetaRow {
        Long getId();
        Long getRecipeId();
        LocalDateTime getCreatedAt();
        String getTitle();
        String getSummary();
        String getImage();
        String getMeta();
    }

    // 🔹 미리보기 상위 N개 (PostgreSQL native)
    @Query(value = """
        select f.id,
               f.recipe_id  as recipeId,
               f.created_at as createdAt,
               w.title      as title,
               w.summary    as summary,
               w.image      as image,
               w.meta       as meta
          from favorite f
          left join wishlist_item w
                 on w.user_id = f.user_id
                and (w.item_key = concat('recipe:', f.recipe_id)
                  or  w.item_key = concat('recipe-', f.recipe_id))
         where f.user_id = :userId
         order by f.created_at desc
         limit :limit
        """,
            nativeQuery = true)
    List<FavoriteWithMetaRow> findTopWithMeta(@Param("userId") Long userId, @Param("limit") int limit);

    // 🔹 페이지 전체 (count 포함)
    @Query(value = """
        select f.id,
               f.recipe_id  as recipeId,
               f.created_at as createdAt,
               w.title      as title,
               w.summary    as summary,
               w.image      as image,
               w.meta       as meta
          from favorite f
          left join wishlist_item w
                 on w.user_id = f.user_id
                and (w.item_key = concat('recipe:', f.recipe_id)
                  or  w.item_key = concat('recipe-', f.recipe_id))
         where f.user_id = :userId
         order by f.created_at desc
        """,
            countQuery = """
        select count(*) from favorite f where f.user_id = :userId
        """,
            nativeQuery = true)
    Page<FavoriteWithMetaRow> findPageWithMeta(@Param("userId") Long userId, Pageable pageable);
}
