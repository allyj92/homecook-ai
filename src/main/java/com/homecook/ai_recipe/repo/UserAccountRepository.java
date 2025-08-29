package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.auth.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {

    // === 기존/호환 메서드들 ===
    Optional<UserAccount> findByEmail(String email);

    // 대소문자 무시 검색 (소셜 이메일 매칭 폴백용)
    Optional<UserAccount> findByEmailIgnoreCase(String email);

    // LocalAuthService에서 호출 (정확히 이 시그니처 필요)
    boolean existsByEmail(String email);

    // 선택: 대소문자 무시 존재여부(다른 곳에서 쓸 수도 있어 같이 둡니다)
    boolean existsByEmailIgnoreCase(String email);
}
