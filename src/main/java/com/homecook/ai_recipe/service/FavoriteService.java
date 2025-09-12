// src/main/java/com/homecook/ai_recipe/service/FavoriteService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.domain.Favorite;
import com.homecook.ai_recipe.repo.FavoriteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final FavoriteRepository favoriteRepository;

    @Transactional(readOnly = true)
    public List<Favorite> list(Long userId) {
        var rows = favoriteRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
        log.debug("[FAVORITE] list uid={} -> {} rows", userId, rows.size());
        return rows;
    }

    @Transactional
    public Favorite add(Long userId, Long recipeId, String title, String summary, String image, String meta) {
        // 중복 방지 (원하면 스킵 말고 에러 던져도 됨)
        favoriteRepository.findByUserIdAndRecipeId(userId, recipeId).ifPresent(f -> {
            log.debug("[FAVORITE] already exists uid={} recipeId={}", userId, recipeId);
            throw new IllegalStateException("already_favorited");
        });

        Favorite f = Favorite.builder()
                .userId(userId)
                .recipeId(recipeId)
                .title(title)
                .summary(summary)
                .image(image)
                .meta(meta)
                .build();
        Favorite saved = favoriteRepository.save(f);
        log.debug("[FAVORITE] add uid={} recipeId={} -> id={}", userId, recipeId, saved.getId());
        return saved;
    }

    @Transactional
    public void remove(Long userId, Long recipeId) {
        log.debug("[FAVORITE] remove uid={} recipeId={}", userId, recipeId);
        favoriteRepository.deleteByUserIdAndRecipeId(userId, recipeId);
    }

    @Transactional(readOnly = true)
    public long count(Long userId) {
        return favoriteRepository.countByUserId(userId);
    }

    @Transactional(readOnly = true)
    public boolean exists(Long userId, Long recipeId) {
        return favoriteRepository.existsByUserIdAndRecipeId(userId, recipeId);
    }
}
