// src/main/java/com/homecook/ai_recipe/repo/CommunityPostBookmarkRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.CommunityPost;
import com.homecook.ai_recipe.domain.CommunityPostBookmark;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface CommunityPostBookmarkRepository
        extends JpaRepository<CommunityPostBookmark, CommunityPostBookmark.PK> {

    long countByPostId(Long postId);
    boolean existsByPostIdAndUserId(Long postId, Long userId);
    void deleteByPostIdAndUserId(Long postId, Long userId);

    @Modifying
    @Query(value = """
        insert into community_post_bookmark (post_id, user_id, created_at)
        values (:postId, :userId, now())
        on conflict (post_id, user_id) do nothing
    """, nativeQuery = true)
    void insertIgnore(@Param("postId") Long postId, @Param("userId") Long userId);

    // ✅ JPQL로 엔티티 매핑 + 카운트 쿼리 분리 (매핑 안전)
    @Query(value = """
        select p
        from CommunityPostBookmark b
          join CommunityPost p on p.id = b.postId
        where b.userId = :uid
        order by b.createdAt desc
        """,
            countQuery = """
        select count(b)
        from CommunityPostBookmark b
        where b.userId = :uid
        """)
    Page<CommunityPost> findBookmarkedPosts(@Param("uid") Long uid, Pageable pageable);

    Page<CommunityPostBookmark> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}
