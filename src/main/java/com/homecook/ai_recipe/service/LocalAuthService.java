// src/main/java/com/homecook/ai_recipe/service/LocalAuthService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LocalAuthService {
    private final UserAccountRepository userRepo;

    public UserAccount register(String email, String password, String name) {
        String normalizedEmail = email == null ? "" : email.trim().toLowerCase();
        String displayName = (name == null || name.isBlank()) ? normalizedEmail : name.trim();

        if (normalizedEmail.isBlank() || password == null || password.isBlank()) {
            throw new IllegalArgumentException("이메일과 비밀번호를 입력하세요.");
        }
        if (userRepo.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("이미 가입된 이메일입니다.");
        }

        String hash = BCrypt.hashpw(password, BCrypt.gensalt(12));

        UserAccount u = new UserAccount();
        u.setEmail(normalizedEmail);
        u.setPasswordHash(hash);
        u.setName(displayName);
        u.setEmailVerified(false);              // 로컬 가입은 기본 false
        u.setCreatedAt(LocalDateTime.now());    // @PrePersist가 있으면 생략 가능
        u.setUpdatedAt(LocalDateTime.now());    // @PreUpdate가 있으면 생략 가능

        return userRepo.save(u);
    }

    public Optional<UserAccount> login(String email, String password) {
        String normalizedEmail = email == null ? "" : email.trim().toLowerCase();
        if (normalizedEmail.isBlank() || password == null || password.isBlank()) {
            return Optional.empty();
        }
        return userRepo.findByEmail(normalizedEmail)
                .filter(u -> BCrypt.checkpw(password, u.getPasswordHash()));
    }
}
