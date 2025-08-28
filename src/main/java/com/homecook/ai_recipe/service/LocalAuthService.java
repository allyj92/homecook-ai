// src/main/java/com/homecook/ai_recipe/service/LocalAuthService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LocalAuthService {
    private final UserAccountRepository userRepo;

    public UserAccount register(String email, String password, String name) {
        if (userRepo.existsByEmail(email)) {
            throw new IllegalArgumentException("이미 가입된 이메일입니다.");
        }
        String hash = BCrypt.hashpw(password, BCrypt.gensalt(12));
        UserAccount u = UserAccount.builder()
                .email(email)
                .passwordHash(hash)
                .name(name)
                .build();
        return userRepo.save(u);
    }

    public Optional<UserAccount> login(String email, String password) {
        return userRepo.findByEmail(email)
                .filter(u -> BCrypt.checkpw(password, u.getPasswordHash()));
    }
}
