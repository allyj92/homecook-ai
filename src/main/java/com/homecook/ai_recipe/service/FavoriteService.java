// src/main/java/com/homecook/ai_recipe/service/FavoriteService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.Favorite;
import com.homecook.ai_recipe.repo.FavoriteRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FavoriteService {
    private final FavoriteRepository favoriteRepository;

    @PersistenceContext
    private EntityManager em;

    @Transactional(readOnly = true)
    public List<Favorite> list(Long userId) {
        return favoriteRepository.findByUser_IdOrderByCreatedAtDesc(userId);
    }

    // 컨트롤러에서 쓰는 2-인자 버전
    @Transactional
    public Favorite add(Long userId, Long recipeId) {
        return add(userId, recipeId, null, null, null, null);
    }

    // 메타 저장 확장
    @Transactional
    public Favorite add(Long userId, Long recipeId, String title, String summary, String image, String meta) {
        return favoriteRepository.findByUser_IdAndRecipeId(userId, recipeId)
                .map(f -> { // ✅ 업데이트
                    if (title   != null) f.setTitle(title);
                    if (summary != null) f.setSummary(summary);
                    if (image   != null) f.setImage(image);
                    if (meta    != null) f.setMeta(meta);
                    return favoriteRepository.save(f);
                })
                .orElseGet(() -> { // ✅ 생성
                    var ua = new UserAccount(); ua.setId(userId);
                    var f = new Favorite();
                    f.setUser(ua);
                    f.setRecipeId(recipeId);
                    f.setTitle(title);
                    f.setSummary(summary);
                    f.setImage(image);
                    f.setMeta(meta);
                    return favoriteRepository.save(f);
                });
    }

    @Transactional
    public void remove(Long userId, Long recipeId) {
        favoriteRepository.deleteByUser_IdAndRecipeId(userId, recipeId);
    }
}