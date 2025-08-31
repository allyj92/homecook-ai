// src/main/java/com/homecook/ai_recipe/service/FavoriteService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.Favorite;
import com.homecook.ai_recipe.repo.FavoriteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FavoriteService {
    private final FavoriteRepository favoriteRepository;

    @Transactional(readOnly = true)
    public List<Favorite> list(Long userId) {
        return favoriteRepository.findByUser_IdOrderByCreatedAtDesc(userId);
    }

    // ✅ 컨트롤러가 부르는 2-인자 버전 그대로 둠
    @Transactional
    public Favorite add(Long userId, Long recipeId) {
        return favoriteRepository.findByUser_IdAndRecipeId(userId, recipeId)
                .orElseGet(() -> {
                    UserAccount ua = new UserAccount();
                    ua.setId(userId);
                    Favorite f = new Favorite();
                    f.setUser(ua);
                    f.setRecipeId(recipeId);
                    return favoriteRepository.save(f);
                });
    }

    @Transactional
    public void remove(Long userId, Long recipeId) {
        favoriteRepository.deleteByUserIdAndRecipeId(userId, recipeId);
    }
}
