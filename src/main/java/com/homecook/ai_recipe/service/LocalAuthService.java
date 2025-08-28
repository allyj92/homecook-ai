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
    private final UserAccountRepository users;

    public UserAccount register(String email, String rawPw, String name) {
        if (users.existsByEmail(email)) throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
        String hash = BCrypt.hashpw(rawPw, BCrypt.gensalt(12));
        UserAccount u = UserAccount.builder()
                .email(email.toLowerCase().trim())
                .passwordHash(hash)
                .name((name==null||name.isBlank()) ? email.split("@")[0] : name.trim())
                .avatar(null)
                .build();
        return users.save(u);
    }

    public Optional<UserAccount> login(String email, String rawPw) {
        return users.findByEmail(email.toLowerCase().trim())
                .filter(u -> BCrypt.checkpw(rawPw, u.getPasswordHash()));
    }
}
