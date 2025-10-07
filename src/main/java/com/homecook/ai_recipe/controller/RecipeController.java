// src/main/java/com/homecook/ai_recipe/controller/RecipeController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.domain.Recipe;
import com.homecook.ai_recipe.dto.RecipeCardDto;
import com.homecook.ai_recipe.dto.RecommendRequest;
import com.homecook.ai_recipe.dto.RecommendResponse;
import com.homecook.ai_recipe.repo.RecipeRepository;
import com.homecook.ai_recipe.service.RecipeAiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import jakarta.validation.Valid; // ✅ javax.validation.Valid(스프링부트3면 jakarta)
import org.springframework.data.domain.*;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
@Slf4j
public class RecipeController {

    private final RecipeAiService ai;
    private final RecipeRepository recipeRepo;

    // --- 추천 ---
    @PostMapping("/recommend")
    public ResponseEntity<RecommendResponse> recommend(@RequestBody @Valid RecommendRequest req) {
        log.info("[API] /api/recommend goals={}, ingredients={}", req.getGoals(), req.getIngredients());
        try {
            var exclude = Optional.ofNullable(req.getExcludeIds()).orElseGet(List::of);
            var out = ai.generate(req, exclude);
            log.info("[API] served_by=AI title={}", out.getTitle());
            return ResponseEntity.ok(out);
        } catch (Exception e) {
            log.error("AI generate failed", e);
            var fb = fallbackRecipe(req, "AI 호출 실패로 임시 레시피를 제공합니다.");
            log.info("[API] served_by=FALLBACK title={}", fb.getTitle());
            return ResponseEntity.ok(fb);
        }
    }

    @GetMapping("/ping")
    public String ping() { return "pong"; }

    // --- 리스트 (정렬/페이징 방어) ---
    // GET /api/recipes?page=0&size=8&sort=createdAt,desc
    @GetMapping("/recipes")
    public ResponseEntity<Page<RecipeCardDto>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "8") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 50); // 상한선

        Sort s = parseSort(sort, "createdAt"); // 잘못된 필드면 기본값
        Page<Recipe> pageData = recipeRepo.findAll(PageRequest.of(safePage, safeSize, s));
        Page<RecipeCardDto> body = pageData.map(this::toCard);

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(15, TimeUnit.SECONDS).cachePublic())
                .body(body);
    }

    // GET /api/recipes/latest?size=8
    @GetMapping("/recipes/latest")
    public ResponseEntity<List<RecipeCardDto>> latest(@RequestParam(defaultValue = "8") int size) {
        int safeSize = Math.min(Math.max(1, size), 20);
        List<RecipeCardDto> body = recipeRepo
                .findAll(PageRequest.of(0, safeSize, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(this::toCard)
                .getContent();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(15, TimeUnit.SECONDS).cachePublic())
                .body(body);
    }

    @GetMapping("/recipes/{id}")
    public ResponseEntity<RecipeCardDto> getOne(@PathVariable Long id) {
        return recipeRepo.findById(id)
                .map(r -> ResponseEntity.ok(toCard(r)))
                .orElseGet(() -> ResponseEntity.notFound().build()); // ✅ 404
    }

    // --- 헬퍼들 ---
    private Sort parseSort(String raw, String defaultProp) {
        try {
            if (raw == null || raw.isBlank()) {
                return Sort.by(Sort.Direction.DESC, defaultProp);
            }
            String[] parts = raw.split(",");
            String prop = parts[0].trim();

            // ✅ 화이트리스트 (원하는 필드만 허용)
            if (!prop.equals("createdAt") && !prop.equals("id")) {
                prop = defaultProp;
            }
            Sort.Direction dir = (parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim()))
                    ? Sort.Direction.ASC : Sort.Direction.DESC;
            return Sort.by(dir, prop);
        } catch (Exception e) {
            log.warn("Invalid sort param: '{}', fallback to {}", raw, defaultProp);
            return Sort.by(Sort.Direction.DESC, defaultProp);
        }
    }

    private RecipeCardDto toCard(Recipe r) {
        Instant created = Optional.ofNullable(r.getCreatedAt()).orElse(Instant.now()); // ← 여기만 수정
        return new RecipeCardDto(
                r.getId(),
                cleanTitle(r.getTitle()),
                created,
                0,
                0,
                null
        );
    }

    private String cleanTitle(String t) {
        if (t == null) return "레시피";
        String x = t.replaceAll("^\\s*[?]?[\\(\\[]?제목을\\s*실제로\\s*넣으세요.*?[)\\]]?\\s*", "");
        x = x.trim();
        return x.isEmpty() ? "레시피" : x;
    }

    private RecommendResponse fallbackRecipe(RecommendRequest req, String reason) {
        List<String> goals = Optional.ofNullable(req).map(RecommendRequest::goalsNormalized).orElseGet(List::of);
        return RecommendResponse.builder()
                .id(0L)
                .title("임시 레시피 (폴백)")
                .summary(reason + " — 입력 재료와 목표를 참고한 간단 레시피입니다.")
                .kcal(420).carbs_g(35).protein_g(32).fat_g(12).sodium_mg(520).cook_time_min(15)
                .ingredients_list(List.of("닭가슴살 150 g","양파 1/2개","파 10 cm","올리브유 1작은술","저염 간장 1작은술(선택)","후추 약간","물 50 ml(선택)"))
                .steps(List.of("양파·파 손질","닭가슴살 굽기","양파·파 볶기","물/간장 넣고 졸이기","마무리"))
                .tips("두부/버섯으로 대체 가능, 저염/저당 팁 포함")
                .goals(goals)
                .build();
    }
}
