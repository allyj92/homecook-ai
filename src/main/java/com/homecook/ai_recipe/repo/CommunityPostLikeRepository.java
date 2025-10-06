// src/main/java/com/homecook/ai_recipe/repo/CommunityPostLikeRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.CommunityPostLike;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface CommunityPostLikeRepository extends JpaRepository<CommunityPostLike, Long> {
    long countByPostId(Long postId);
    boolean existsByPostIdAndUserId(Long postId, Long userId);
    void deleteByPostIdAndUserId(Long postId, Long userId);

    @Modifying
    @Query(value = """
        insert into community_post_like (post_id, user_id, created_at)
        values (:postId, :userId, now())
        on conflict (post_id, user_id) do nothing
    """, nativeQuery = true)
    void insertIgnore(@Param("postId") Long postId, @Param("userId") Long userId);
}
