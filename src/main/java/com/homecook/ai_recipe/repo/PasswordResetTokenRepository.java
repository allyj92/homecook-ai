package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.auth.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByTokenAndUsedFalse(String token);

    Optional<PasswordResetToken> findTopByUserIdOrderByCreatedAtDesc(Long userId);
}