// src/main/java/com/homecook/ai_recipe/service/FavoriteService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.Favorite;
import com.homecook.ai_recipe.repo.FavoriteRepository;
import com.homecook.ai_recipe.repo.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final UserAccountRepository userAccountRepository;

    @Transactional(readOnly = true)
    public List<Favorite> list(Long userId) {
        return favoriteRepository.findByUser_IdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public Favorite add(Long userId, Long recipeId) {
        // 1) UserAccount 엔티티를 꼭 로드해서 setUser(user)로 설정
        UserAccount user = userAccountRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found"));

        // 2) 이미 있으면 그대로 반환 (unique 중복 방지)
        return favoriteRepository.findByUser_IdAndRecipeId(userId, recipeId)
                .orElseGet(() -> {
                    Favorite f = new Favorite();
                    f.setUser(user);            // ⚠️ setUserId 아닙니다
                    f.setRecipeId(recipeId);
                    return favoriteRepository.save(f);
                });
    }

    @Transactional
    public void remove(Long userId, Long recipeId) {
        favoriteRepository.deleteByUser_IdAndRecipeId(userId, recipeId);
    }
}
