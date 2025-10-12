package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.domain.ActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.repository.query.Param;


public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    Page<ActivityLog> findByUser_IdOrderByIdDesc(Long userId, Pageable pageable);
//    @Modifying
//    @Transactional
//    @Query(value = """
//        delete from activity_log
//        where user_id = :uid
//          and id not in (
//            select id from activity_log
//            where user_id = :uid
//            order by id desc
//            limit :keep
//          )
//        """, nativeQuery = true)

    /**
     * 경계 ID를 구하기 위한 아이디 목록 조회 (내림차순)
     */
    @Query("select a.id from ActivityLog a where a.user.id = :uid order by a.id desc")
    Page<Long> findIdsByUserOrderByIdDesc(@Param("uid") Long uid, Pageable pageable);

    @Modifying
    @Transactional
    @Query("delete from ActivityLog a where a.user.id = :uid and a.id < :minId")
    int deleteOlderThan(@Param("uid") Long uid, @Param("minId") Long minId);

}