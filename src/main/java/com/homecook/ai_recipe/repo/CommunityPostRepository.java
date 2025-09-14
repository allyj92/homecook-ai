// src/main/java/com/homecook/ai_recipe/repo/CommunityPostRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.CommunityPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;          // ✅ 추가
import org.springframework.data.repository.query.Param;    // ✅ 추가

import java.util.List;                                    // ✅ 추가

public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long> {

    Page<CommunityPost> findByAuthorId(Long authorId, Pageable pageable);

    // ✅ category가 null/빈문자면 전체, 아니면 해당 카테고리만 최신순
    @Query("""
        select p from CommunityPost p
        where (:category is null or :category = '' or p.category = :category)
        order by p.createdAt desc
    """)
    Page<CommunityPost> findLatest(@Param("category") String category, Pageable pageable);
}