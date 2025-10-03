package com.homecook.ai_recipe.repo;



import com.homecook.ai_recipe.domain.UserActivity;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface UserActivityRepository extends JpaRepository<UserActivity, Long> {
    Page<UserActivity> findByUserIdOrderByTsDesc(Long userId, Pageable pageable);

    @Modifying
    @Query(value = """
      delete from user_activity
      where user_id = :uid
        and id not in (
          select id from user_activity
          where user_id = :uid
          order by ts desc
          limit :keep
        )
      """, nativeQuery = true)
    int pruneOld(Long uid, int keep);
}