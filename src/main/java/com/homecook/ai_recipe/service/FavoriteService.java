// src/main/java/com/homecook/ai_recipe/service/FavoriteService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.Favorite;
import com.homecook.ai_recipe.repo.FavoriteRepository;
import lombok.RequiredArgsConstructor;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FavoriteService {
    private final FavoriteRepository favoriteRepository;

    @Transactional(readOnly = true)
    public List<Favorite> list(Long userId) {
        return favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // 컨트롤러에서 쓰는 2인자 버전
    @Transactional
    public Favorite add(Long userId, Long recipeId) {
        return add(userId, recipeId, null, null, null, null);
    }

    // 확장 버전
    @Transactional
    public Favorite add(Long userId, Long recipeId, String title, String summary, String image, String meta) {
        // 이미 있으면 그대로 반환
        var existing = favoriteRepository.findByUser_IdAndRecipeId(userId, recipeId);
        if (existing.isPresent()) return existing.get();

        // 연관키만 셋
        var ua = new UserAccount();
        ua.setId(userId);

        var f = new Favorite();
        f.setUser(ua);
        f.setRecipeId(recipeId);
        if (title   != null) f.setTitle(title);
        if (summary != null) f.setSummary(summary);
        if (image   != null) f.setImage(image);
        if (meta    != null) f.setMeta(meta);
        if (f.getCreatedAt() == null) f.setCreatedAt(LocalDateTime.now());

        try {
            return favoriteRepository.saveAndFlush(f);
        } catch (DataIntegrityViolationException e) {
            // 유니크 충돌 시 멱등 반환
            var again = favoriteRepository.findByUser_IdAndRecipeId(userId, recipeId);
            if (again.isPresent()) return again.get();
            throw e;
        } catch (ConstraintViolationException e) {
            var again = favoriteRepository.findByUser_IdAndRecipeId(userId, recipeId);
            if (again.isPresent()) return again.get();
            throw e;
        }
    }

    @Transactional
    public void remove(Long userId, Long recipeId) {
        favoriteRepository.deleteByUserIdAndRecipeId(userId, recipeId);
    }
}
