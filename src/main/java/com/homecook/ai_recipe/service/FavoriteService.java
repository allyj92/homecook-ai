// src/main/java/com/homecook/ai_recipe/service/FavoriteService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.domain.Favorite;
import com.homecook.ai_recipe.domain.Recipe;
import com.homecook.ai_recipe.repo.FavoriteRepository;
import com.homecook.ai_recipe.repo.RecipeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.lang.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final RecipeRepository recipeRepository;

    private String currentProvider() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof OAuth2AuthenticationToken o) {
            return o.getAuthorizedClientRegistrationId();
        }
        return "common";
    }

    /* ======== 조회 ======== */

    @Transactional(readOnly = true)
    public List<Favorite> list(Long userId) {
        String provider = currentProvider();
        var rows = favoriteRepository.findAllByUserIdAndProviderOrderByCreatedAtDesc(userId, provider);
        log.debug("[FAVORITE] list uid={} provider={} -> {} rows", userId, provider, rows.size());
        return rows;
    }

    @Transactional(readOnly = true)
    public List<Favorite> list(Long userId, @Nullable String provider) {
        String p = (provider == null || provider.isBlank()) ? currentProvider() : provider;
        return favoriteRepository.findAllByUserIdAndProviderOrderByCreatedAtDesc(userId, p);
    }

    /* ======== 저장 ======== */

    @Transactional
    public Favorite add(Long userId, Long recipeId, String title, String summary, String image, String meta) {
        final String provider = currentProvider();

        // 이미 존재하면 업데이트 방식으로 병합
        var existed = favoriteRepository.findByUserIdAndProviderAndRecipeId(userId, provider, recipeId);
        if (existed.isPresent()) {
            Favorite f = existed.get();

            // 요청값 우선 적용
            if (!isBlank(title))   f.setTitle(title.trim());
            if (!isBlank(summary)) f.setSummary(summary.trim());
            if (!isBlank(image))   f.setImage(image.trim()); // Recipe엔 image 없음
            if (!isBlank(meta))    f.setMeta(meta.trim());

            // 내부 레시피로 부족한 필드 보강
            fillFromRecipeIfBlank(recipeId, f);

            // 최종 fallback: 제목이 여전히 비면 "레시피 #<id>"
            if (isBlank(f.getTitle())) {
                f.setTitle("레시피 #" + recipeId);
            }
            return favoriteRepository.save(f);
        }

        // 신규
        Favorite toSave = Favorite.builder()
                .userId(userId)
                .provider(provider)
                .recipeId(recipeId)
                .title(trimOrNull(title))
                .summary(trimOrNull(summary))
                .image(trimOrNull(image))
                .meta(trimOrNull(meta))
                .build();

        // 내부 레시피로 보강
        fillFromRecipeIfBlank(recipeId, toSave);

        // 최종 fallback: 제목이 비면 "레시피 #<id>"
        if (isBlank(toSave.getTitle())) {
            toSave.setTitle("레시피 #" + recipeId);
        }

        // 저장(경쟁 시 중복 처리)
        try {
            return favoriteRepository.save(toSave);
        } catch (DataIntegrityViolationException dup) {
            log.debug("[FAVORITE] duplicate caught on save (uid={}, provider={}, recipeId={})", userId, provider, recipeId);
            // 충돌 시 기존 레코드 반환 (첫 저장 트랜잭션이 이미 보강/기본값을 채웠을 것)
            return favoriteRepository
                    .findByUserIdAndProviderAndRecipeId(userId, provider, recipeId)
                    .orElseThrow(() -> dup);
        }
    }

    @Transactional
    public Favorite add(Long userId, String provider, Long recipeId,
                        String title, String summary, String image, String meta) {
        final String p = (provider == null || provider.isBlank()) ? currentProvider() : provider;

        var existed = favoriteRepository.findByUserIdAndProviderAndRecipeId(userId, p, recipeId);
        if (existed.isPresent()) {
            Favorite f = existed.get();

            if (!isBlank(title))   f.setTitle(title.trim());
            if (!isBlank(summary)) f.setSummary(summary.trim());
            if (!isBlank(image))   f.setImage(image.trim());
            if (!isBlank(meta))    f.setMeta(meta.trim());

            fillFromRecipeIfBlank(recipeId, f);
            if (isBlank(f.getTitle())) {
                f.setTitle("레시피 #" + recipeId);
            }
            return favoriteRepository.save(f);
        }

        Favorite toSave = Favorite.builder()
                .userId(userId)
                .provider(p)
                .recipeId(recipeId)
                .title(trimOrNull(title))
                .summary(trimOrNull(summary))
                .image(trimOrNull(image))
                .meta(trimOrNull(meta))
                .build();

        fillFromRecipeIfBlank(recipeId, toSave);
        if (isBlank(toSave.getTitle())) {
            toSave.setTitle("레시피 #" + recipeId);
        }

        try {
            return favoriteRepository.save(toSave);
        } catch (DataIntegrityViolationException dup) {
            log.debug("[FAVORITE] duplicate caught on save (uid={}, provider={}, recipeId={})", userId, p, recipeId);
            return favoriteRepository
                    .findByUserIdAndProviderAndRecipeId(userId, p, recipeId)
                    .orElseThrow(() -> dup);
        }
    }

    /* ======== 삭제/카운트/존재 ======== */

    @Transactional
    public void remove(Long userId, Long recipeId) {
        String provider = currentProvider();
        favoriteRepository.deleteByUserIdAndProviderAndRecipeId(userId, provider, recipeId);
    }

    @Transactional
    public void remove(Long userId, String provider, Long recipeId) {
        String p = (provider == null || provider.isBlank()) ? currentProvider() : provider;
        favoriteRepository.deleteByUserIdAndProviderAndRecipeId(userId, p, recipeId);
    }

    @Transactional(readOnly = true)
    public long count(Long userId) {
        String provider = currentProvider();
        return favoriteRepository.countByUserIdAndProvider(userId, provider);
    }

    @Transactional(readOnly = true)
    public boolean exists(Long userId, Long recipeId) {
        String provider = currentProvider();
        return favoriteRepository.existsByUserIdAndProviderAndRecipeId(userId, provider, recipeId);
    }

    /* ======== helpers ======== */

    /** 내부 recipe가 있을 때 비어 있는 필드를 보강(제목/요약/meta) */
    private void fillFromRecipeIfBlank(Long recipeId, Favorite f) {
        if (!isBlank(f.getTitle()) && !isBlank(f.getSummary()) && !isBlank(f.getMeta())) return;

        recipeRepository.findById(recipeId).ifPresent(r -> {
            if (isBlank(f.getTitle()))   f.setTitle(trimOrNull(r.getTitle()));
            if (isBlank(f.getSummary())) f.setSummary(trimOrNull(r.getSummary()));
            // Recipe에는 image 필드가 없으므로 image는 그대로 둠
            if (isBlank(f.getMeta()))    f.setMeta(buildMeta(r)); // "380kcal · 18분"
        });
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }
    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /** "380kcal · 18분" 메타 생성(값 없으면 null) */
    private static String buildMeta(Recipe r) {
        if (r == null) return null;
        StringBuilder sb = new StringBuilder();
        if (r.getKcal() != null) {
            sb.append(r.getKcal()).append("kcal");
        }
        if (r.getCookTimeMin() != null) {
            if (sb.length() > 0) sb.append(" · ");
            sb.append(r.getCookTimeMin()).append("분");
        }
        String s = sb.toString().trim();
        return s.isEmpty() ? null : s;
    }
}
