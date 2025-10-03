package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.CommunityComment;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CommunityCommentRepository extends JpaRepository<CommunityComment, Long> {
    @Query("""
    select c from CommunityComment c
    join fetch c.author a
    where c.post.id = :postId
      and (:afterId is null or c.id < :afterId)
    order by c.id desc
  """)
    List<CommunityComment> findPage(@Param("postId") Long postId,
                                    @Param("afterId") Long afterId,
                                    Pageable pageable);

    long countByPost_IdAndDeletedFalse(Long postId);
}
