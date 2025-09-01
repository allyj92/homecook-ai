package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.CommunityPost;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long> {}
