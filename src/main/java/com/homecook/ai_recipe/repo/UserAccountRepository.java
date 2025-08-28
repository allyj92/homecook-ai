// src/main/java/com/homecook/ai_recipe/repo/UserAccountRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.auth.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    Optional<UserAccount> findByEmail(String email);   // ← 추가
    boolean existsByEmail(String email);               // (선택) 중복 체크에 유용
}