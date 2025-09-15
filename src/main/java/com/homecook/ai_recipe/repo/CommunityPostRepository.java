// src/main/java/com/homecook/ai_recipe/repo/CommunityPostRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.CommunityPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long> {

    // 내가 쓴 글 페이징
    Page<CommunityPost> findByAuthorId(Long authorId, Pageable pageable);

    // 카테고리 필터(없으면 전체) + 최신순
    @Query("""
        select p from CommunityPost p
        where (:category is null or :category = '' or p.category = :category)
        order by p.createdAt desc
    """)
    Page<CommunityPost> findByCategory(@Param("category") String category, Pageable pageable);

    // ✅ 수정 시 소유자 검증용
    Optional<CommunityPost> findByIdAndAuthorId(Long id, Long authorId);
}