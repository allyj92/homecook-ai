// src/main/java/com/homecook/ai_recipe/repo/AccountLinkTokenRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.auth.AccountLinkToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;

public interface AccountLinkTokenRepository extends JpaRepository<AccountLinkToken, Long> {
    Optional<AccountLinkToken> findByToken(String token);
    long deleteByExpiresAtBefore(Instant now);
}
