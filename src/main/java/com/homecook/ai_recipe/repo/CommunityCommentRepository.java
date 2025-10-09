package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.CommunityComment;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface CommunityCommentRepository extends JpaRepository<CommunityComment, Long> {

    /* ✅ 페이지 조회 시 삭제된 댓글 제외 */
    @Query("""
      select c from CommunityComment c
      join fetch c.author a
      where c.post.id = :postId
        and c.deleted = false
        and (:afterId is null or c.id < :afterId)
      order by c.id desc
    """)
    List<CommunityComment> findPage(@Param("postId") Long postId,
                                    @Param("afterId") Long afterId,
                                    Pageable pageable);

    long countByPost_IdAndDeletedFalse(Long postId);

    /* ✅ 단건 조회(권한/존재 체크용) */
    Optional<CommunityComment> findByIdAndPost_IdAndDeletedFalse(Long id, Long postId);

    /* ✅ 작성자 일치 여부(권한 체크용) */
    boolean existsByIdAndAuthor_Id(Long id, Long authorId);

    /* ✅ 소프트 삭제 (updatedAt 같이 갱신) */
    @Modifying
    @Transactional
    @Query("""
      update CommunityComment c
         set c.deleted = true,
             c.updatedAt = current_timestamp
       where c.id = :commentId
         and c.post.id = :postId
         and c.deleted = false
    """)
    int softDelete(@Param("postId") Long postId, @Param("commentId") Long commentId);

    /* (선택) 글 삭제 시 댓글 일괄 소프트 삭제 */
    @Modifying
    @Transactional
    @Query("""
      update CommunityComment c
         set c.deleted = true,
             c.updatedAt = current_timestamp
       where c.post.id = :postId and c.deleted = false
    """)
    int softDeleteAllByPostId(@Param("postId") Long postId);
}