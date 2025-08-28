// src/main/java/com/homecook/ai_recipe/repo/UserAccountRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.auth.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    Optional<UserAccount> findByEmail(String email);
    boolean existsByEmail(String email);
}