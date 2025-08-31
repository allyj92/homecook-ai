// src/main/java/com/homecook/ai_recipe/service/FavoriteService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.Favorite;
import com.homecook.ai_recipe.repo.FavoriteRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final UserAccountRepository userAccountRepository;

    /** 목록 조회 */
    @Transactional(readOnly = true)
    public List<Favorite> list(Long userId) {
        // 관계 경로를 이용한 파생 쿼리: user.id
        return favoriteRepository.findByUser_IdOrderByCreatedAtDesc(userId);
    }

    /** 추가 (이미 있으면 기존 것 반환) */
    @Transactional
    public Favorite add(Long userId, Long recipeId) {
        // 1) 유저 엔티티 로드
        UserAccount user = userAccountRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        // 2) 중복이면 기존 레코드 반환
        if (favoriteRepository.existsByUser_IdAndRecipeId(userId, recipeId)) {
            // 가벼운 구현: 목록 조회 후 필터
            return favoriteRepository.findByUser_IdOrderByCreatedAtDesc(userId).stream()
                    .filter(f -> recipeId.equals(f.getRecipeId()))
                    .findFirst()
                    .orElseGet(() -> {
                        // 혹시 못 찾으면 안전하게 하나 만들어 반환(저장 X)
                        Favorite f = new Favorite();
                        f.setUser(user);
                        f.setRecipeId(recipeId);
                        return f;
                    });
        }

        // 3) 신규 생성
        Favorite f = new Favorite();
        f.setUser(user);          // ✅ setUserId(...)가 아니라 setUser(user)
        f.setRecipeId(recipeId);

        try {
            return favoriteRepository.save(f);
        } catch (DataIntegrityViolationException e) {
            // 동시성 등으로 유니크 제약 충돌 시 기존 레코드 반환
            return favoriteRepository.findByUser_IdOrderByCreatedAtDesc(userId).stream()
                    .filter(x -> recipeId.equals(x.getRecipeId()))
                    .findFirst()
                    .orElseThrow(() -> e);
        }
    }

    /** 삭제 (없어도 예외 없이 통과) */
    @Transactional
    public void remove(Long userId, Long recipeId) {
        favoriteRepository.deleteByUser_IdAndRecipeId(userId, recipeId);
    }
}
