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
    private final UserAccountRepository userRepo;

    @Transactional(readOnly = true)
    public List<Favorite> list(Long userId) {
        return favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public Favorite add(Long userId, Long recipeId) {
        // 이미 있으면 그대로 반환(멱등)
        var exists = favoriteRepository.findByUserIdAndRecipeId(userId, recipeId).orElse(null);
        if (exists != null) return exists;

        // 사용자 프록시 참조(존재 안 하면 404로 처리하기 위해 실제 조회)
        UserAccount user = userRepo.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("user not found: " + userId));

        Favorite f = new Favorite();
        f.setUser(user);                // ← @ManyToOne에 UserAccount 넣기
        f.setRecipeId(recipeId);

        try {
            return favoriteRepository.saveAndFlush(f);
        } catch (DataIntegrityViolationException dup) {
            // 동시요청 등으로 유니크 제약에 걸리면 기존 값 리턴
            return favoriteRepository.findByUserIdAndRecipeId(userId, recipeId)
                    .orElseThrow(() -> dup);
        }
    }

    @Transactional
    public void remove(Long userId, Long recipeId) {
        favoriteRepository.deleteByUserIdAndRecipeId(userId, recipeId);
    }
}
