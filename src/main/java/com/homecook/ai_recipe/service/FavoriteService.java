// src/main/java/com/homecook/ai_recipe/service/FavoriteService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.domain.Favorite;
import com.homecook.ai_recipe.repo.FavoriteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// src/main/java/com/homecook/ai_recipe/service/FavoriteService.java
@Service
@RequiredArgsConstructor
public class FavoriteService {
    private final FavoriteRepository favoriteRepository;

    @Transactional(readOnly = true)
    public List<Favorite> list(Long userId) {
        return favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public Favorite add(Long userId, Long recipeId, String title, String summary, String image, String meta) {
        var existed = favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(f -> f.getRecipeId().equals(recipeId))
                .findFirst();
        if (existed.isPresent()) return existed.get();

        var f = new Favorite();
        f.setUserId(userId);
        f.setRecipeId(recipeId);
        f.setTitle(title);
        f.setSummary(summary);
        f.setImage(image);
        f.setMeta(meta);
        return favoriteRepository.save(f);
    }

    @Transactional
    public void remove(Long userId, Long recipeId) {
        favoriteRepository.deleteByUserIdAndRecipeId(userId, recipeId);
    }
}
