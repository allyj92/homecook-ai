// src/main/java/com/homecook/ai_recipe/repo/UserAccountRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.auth.UserAccount;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    Optional<UserAccount> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);

    // 대소문자 무시(로컬/소셜 모두 여기로 통일해서 사용)


    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        INSERT INTO user_account (email, name, avatar, email_verified, created_at, updated_at)
        VALUES (:email, :name, :avatar, :emailVerified, now(), now())
        ON CONFLICT ((lower(email)))
        DO UPDATE SET
          name = COALESCE(EXCLUDED.name, user_account.name),
          avatar = COALESCE(EXCLUDED.avatar, user_account.avatar),
          email_verified = user_account.email_verified OR EXCLUDED.email_verified,
          updated_at = now()
        RETURNING id;
        """, nativeQuery = true)
    Long upsertUserAndReturnId(@Param("email") String email,
                               @Param("name") String name,
                               @Param("avatar") String avatar,
                               @Param("emailVerified") boolean emailVerified);
}
