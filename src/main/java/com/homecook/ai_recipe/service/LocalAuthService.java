// src/main/java/com/homecook/ai_recipe/service/LocalAuthService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LocalAuthService {
    private final UserAccountRepository userRepo;

    private static String norm(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public UserAccount register(String email, String password, String name) {
        String normalizedEmail = norm(email);
        String displayName = (name == null || name.isBlank()) ? normalizedEmail : name.trim();

        if (normalizedEmail.isBlank() || password == null || password.isBlank()) {
            throw new IllegalArgumentException("이메일과 비밀번호를 입력하세요.");
        }

        // existsByEmail → existsByEmailIgnoreCase 로 교체
        if (userRepo.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("이미 가입된 이메일입니다.");
        }

        String hash = BCrypt.hashpw(password, BCrypt.gensalt(12));

        UserAccount u = new UserAccount();
        u.setEmail(normalizedEmail);
        u.setPasswordHash(hash);
        u.setName(displayName);
        u.setEmailVerified(false); // 로컬 가입은 기본 false
        // createdAt/updatedAt은 엔티티의 @PrePersist/@PreUpdate에서 처리

        try {
            return userRepo.save(u);
        } catch (DataIntegrityViolationException e) {
            // 경합으로 동일 이메일이 거의 동시에 들어온 경우 대비
            throw new IllegalArgumentException("이미 가입된 이메일입니다.", e);
        }
    }

    public Optional<UserAccount> login(String email, String password) {
        String normalizedEmail = norm(email);
        if (normalizedEmail.isBlank() || password == null || password.isBlank()) {
            return Optional.empty();
        }

        // findByEmail → findByEmailIgnoreCase 로 교체
        return userRepo.findByEmailIgnoreCase(normalizedEmail)
                .filter(u -> u.getPasswordHash() != null && BCrypt.checkpw(password, u.getPasswordHash()));
    }
}
