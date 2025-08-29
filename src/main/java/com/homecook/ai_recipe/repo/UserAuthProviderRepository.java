// src/main/java/com/homecook/ai_recipe/repo/UserAuthProviderRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.auth.UserAuthProvider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserAuthProviderRepository extends JpaRepository<UserAuthProvider, Long> {
    Optional<UserAuthProvider> findByProviderAndProviderId(String provider, String providerId);
    boolean existsByUserIdAndProvider(Long userId, String provider);
}