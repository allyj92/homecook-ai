package com.homecook.ai_recipe.repo;


import com.homecook.ai_recipe.domain.CommunityPostBookmark;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CommunityPostBookmarkRepository extends JpaRepository<CommunityPostBookmark, CommunityPostBookmark.PK> {
    boolean existsByUserIdAndPostId(Long userId, Long postId);
    void deleteByUserIdAndPostId(Long userId, Long postId);

    Page<CommunityPostBookmark> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    @Query(value = """
      select p.* from community_post p
      join community_post_bookmark b on b.post_id = p.id
      where b.user_id = :uid
      order by b.created_at desc
      """,
            countQuery = "select count(*) from community_post_bookmark where user_id = :uid",
            nativeQuery = true)
    Page<Object[]> findBookmarkedPosts(@Param("uid") Long uid, Pageable pageable);
}
