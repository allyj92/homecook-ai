package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.CommunityPost;
import com.homecook.ai_recipe.domain.CommunityPostBookmark;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface CommunityPostBookmarkRepository
        extends JpaRepository<CommunityPostBookmark, CommunityPostBookmark.PK> {

    // 집계
    long countByPostId(Long postId);

    // 토글 시 사용
    boolean existsByPostIdAndUserId(Long postId, Long userId);

    void deleteByPostIdAndUserId(Long postId, Long userId);

    // 중복 삽입 무시(UPSERT)
    @Modifying
    @Query(value = """
        insert into community_post_bookmark (post_id, user_id, created_at)
        values (:postId, :userId, now())
        on conflict (post_id, user_id) do nothing
    """, nativeQuery = true)
    void insertIgnore(@Param("postId") Long postId, @Param("userId") Long userId);

    // 마이페이지: 내가 북마크한 글 목록 (엔티티로 바로 매핑)
    @Query(value = """
        select p.* 
        from community_post p
        join community_post_bookmark b on b.post_id = p.id
        where b.user_id = :uid
        order by b.created_at desc
        """,
            countQuery = """
        select count(*) 
        from community_post_bookmark 
        where user_id = :uid
        """,
            nativeQuery = true)
    Page<CommunityPost> findBookmarkedPosts(@Param("uid") Long uid, Pageable pageable);

    // (선택) 북마크 행 자체를 최근순으로
    Page<CommunityPostBookmark> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}