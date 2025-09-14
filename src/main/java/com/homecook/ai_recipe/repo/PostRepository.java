// PostRepository.java (혹은 CommunityPostRepository.java)
// 패키지/이름은 프로젝트에 맞춰 사용
package com.homecook.ai_recipe.repository;

import com.homecook.ai_recipe.domain.CommunityPost; // ✅ 실제 엔티티로 바꿔주세요
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

// ✅ 반드시 interface 여야 합니다.
public interface PostRepository extends JpaRepository<CommunityPost, Long> {

    @Query("""
       select p
       from CommunityPost p
       where (:category is null or p.category = :category)
       order by p.createdAt desc
    """)
    List<CommunityPost> findLatest(@Param("category") String category, Pageable pageable); // ✅ 바디 없음
}
