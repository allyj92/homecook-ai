package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.ActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    Page<ActivityLog> findByUser_IdOrderByIdDesc(Long userId, Pageable pageable);
    @Modifying
    @Transactional
    @Query(value = """
        delete from activity_log
        where user_id = :uid
          and id not in (
            select id from activity_log
            where user_id = :uid
            order by id desc
            limit :keep
          )
        """, nativeQuery = true)
    int pruneOld(Long uid, int keep);
}