// src/main/java/com/homecook/ai_recipe/service/FavoriteService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.Favorite;
import com.homecook.ai_recipe.repo.FavoriteRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service @RequiredArgsConstructor
public class FavoriteService {
    private final FavoriteRepository favoriteRepo;
    private final UserAccountRepository userRepo;

    public List<Favorite> list(Long userId) {
        return favoriteRepo.findAllByUser_IdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public Favorite add(Long userId, Long recipeId) {
        if (favoriteRepo.existsByUser_IdAndRecipeId(userId, recipeId)) {
            return favoriteRepo.findByUser_IdAndRecipeId(userId, recipeId).get();
        }
        UserAccount user = userRepo.findById(userId).orElseThrow();
        Favorite f = new Favorite();
        f.setUser(user);
        f.setRecipeId(recipeId);
        return favoriteRepo.save(f);
    }

    @Transactional
    public void remove(Long userId, Long recipeId) {
        favoriteRepo.findByUser_IdAndRecipeId(userId, recipeId)
                .ifPresent(favoriteRepo::delete);
    }
}
