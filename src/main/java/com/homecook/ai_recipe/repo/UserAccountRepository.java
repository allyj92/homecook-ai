// src/main/java/com/homecook/ai_recipe/repo/UserAccountRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.auth.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {

    // 이메일 정확히 일치
    Optional<UserAccount> findByEmail(String email);

    // 이메일 대소문자 무시
    Optional<UserAccount> findByEmailIgnoreCase(String email);

    // (선택) 빠른 체크가 필요하면
    boolean existsByEmail(String email);
}