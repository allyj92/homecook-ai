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
        // 대소문자 무시로 중복 체크
        if (userRepo.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("이미 가입된 이메일입니다.");
        }

        String hash = BCrypt.hashpw(password, BCrypt.gensalt(12));

        UserAccount u = new UserAccount();
        u.setEmail(normalizedEmail);
        u.setPasswordHash(hash);
        u.setName(displayName);
        u.setEmailVerified(false);
        u.setCreatedAt(LocalDateTime.now());
        u.setUpdatedAt(LocalDateTime.now());

        return userRepo.save(u);
    }

    public Optional<UserAccount> login(String email, String password) {
        String normalizedEmail = email == null ? "" : email.trim().toLowerCase();
        if (normalizedEmail.isBlank() || password == null || password.isBlank()) {
            return Optional.empty();
        }

        // 이메일은 대소문자 무시로 찾기
        return userRepo.findByEmailIgnoreCase(normalizedEmail)
                .filter(u -> {
                    String hash = u.getPasswordHash();
                    // hash가 없거나 빈 경우 -> 로컬 로그인 불가
                    if (hash == null || hash.isBlank()) return false;
                    try {
                        return BCrypt.checkpw(password, hash);
                    } catch (Exception ignore) {
                        // 손상된 해시 등 예외 발생 시 매치 실패로 처리
                        return false;
                    }
                });
    }
}
