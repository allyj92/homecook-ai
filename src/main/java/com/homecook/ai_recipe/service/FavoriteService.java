// src/main/java/com/homecook/ai_recipe/service/FavoriteService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.domain.Favorite;
import com.homecook.ai_recipe.repo.FavoriteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FavoriteService {
    private final FavoriteRepository favoriteRepository;

    @Transactional(readOnly = true)
    public List<Favorite> list(Long userId) {
        return favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public Favorite add(Long userId, Long recipeId) {
        // 이미 있으면 그대로 반환
        if (favoriteRepository.existsByUserIdAndRecipeId(userId, recipeId)) {
            return favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                    .filter(f -> f.getRecipeId().equals(recipeId))
                    .findFirst()
                    .orElseGet(() -> {
                        Favorite f = new Favorite();
                        f.setUserId(userId);
                        f.setRecipeId(recipeId);
                        return favoriteRepository.save(f);
                    });
        }
        try {
            Favorite f = new Favorite();
            f.setUserId(userId);
            f.setRecipeId(recipeId);
            return favoriteRepository.save(f);
        } catch (DataIntegrityViolationException e) {
            // 유니크 충돌/제약 충돌 시에도 최대한 기존 레코드 리턴
            return favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                    .filter(f -> f.getRecipeId().equals(recipeId))
                    .findFirst()
                    .orElseThrow();
        }
    }

    @Transactional
    public void remove(Long userId, Long recipeId) {
        favoriteRepository.deleteByUserIdAndRecipeId(userId, recipeId);
    }
}
