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
        // 이미 있으면 바로 반환
        var existing = favoriteRepository.findByUser_IdAndRecipeId(userId, recipeId);
        if (existing.isPresent()) return existing.get();

        // 연관키는 프록시로만 설정 (DB hit 없이)
        UserAccount ua = em.getReference(UserAccount.class, userId);

        Favorite f = new Favorite();
        f.setUser(ua);
        f.setRecipeId(recipeId);
        if (f.getCreatedAt() == null) f.setCreatedAt(LocalDateTime.now());

        try {
            return favoriteRepository.save(f);
        } catch (DataIntegrityViolationException dup) {
            // 동시성/유니크 충돌 시 기존 행 반환
            return favoriteRepository.findByUser_IdAndRecipeId(userId, recipeId).orElseThrow();
        }
    }

    @Transactional
    public void remove(Long userId, Long recipeId) {
        favoriteRepository.deleteByUser_IdAndRecipeId(userId, recipeId);
    }
}
