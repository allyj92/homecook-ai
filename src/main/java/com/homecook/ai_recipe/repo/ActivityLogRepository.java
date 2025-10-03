package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.ActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    Page<ActivityLog> findByUser_IdOrderByIdDesc(Long userId, Pageable pageable);
}