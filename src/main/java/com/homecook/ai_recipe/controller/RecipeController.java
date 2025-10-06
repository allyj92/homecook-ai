// src/main/java/com/homecook/ai_recipe/controller/RecipeController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.domain.Recipe;
import com.homecook.ai_recipe.dto.RecipeCardDto;
import com.homecook.ai_recipe.dto.RecommendRequest;
import com.homecook.ai_recipe.dto.RecommendResponse;
import com.homecook.ai_recipe.repo.RecipeRepository;
import com.homecook.ai_recipe.service.RecipeAiService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class RecipeController {

    private final RecipeAiService ai;
    private final RecipeRepository recipeRepo;   // ✅ 추가

    // --- 기존 ---
    @PostMapping("/recommend")
    public ResponseEntity<?> recommend(@RequestBody @Validated RecommendRequest req) {
        System.out.println("[API] HIT /api/recommend goals=" + req.getGoals() + " ingredients=" + req.getIngredients());
        try {
            var exclude = Optional.ofNullable(req.getExcludeIds()).orElseGet(List::of);
            var out = ai.generate(req, exclude);
            System.out.println("[API] served_by=AI title=" + out.getTitle());
            return ResponseEntity.ok(out);
        } catch (Exception e) {
            e.printStackTrace();
            var fb = fallbackRecipe(req, "AI 호출 실패로 임시 레시피를 제공합니다.");
            System.out.println("[API] served_by=FALLBACK title=" + fb.getTitle());
            return ResponseEntity.ok(fb);
        }
    }

    @GetMapping("/ping")
    public String ping() { return "pong"; }

    // --- ✅ 프런트가 호출하는 최신순 목록 ---
    // GET /api/recipes?page=0&size=8&sort=createdAt,desc
    @GetMapping("/recipes")
    public Page<RecipeCardDto> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "8") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        Sort s = Sort.by(Sort.Direction.DESC, "createdAt");
        if (sort != null && !sort.isBlank()) {
            String[] parts = sort.split(",");
            String prop = parts[0].trim();
            Sort.Direction dir = (parts.length > 1 && parts[1].trim().equalsIgnoreCase("asc"))
                    ? Sort.Direction.ASC : Sort.Direction.DESC;
            s = Sort.by(dir, prop);
        }
        Page<Recipe> pageData = recipeRepo.findAll(PageRequest.of(page, size, s));
        return pageData.map(this::toCard);
    }

    // GET /api/recipes/latest?size=8
    @GetMapping("/recipes/latest")
    public List<RecipeCardDto> latest(@RequestParam(defaultValue = "8") int size) {
        return recipeRepo
                .findAll(PageRequest.of(0, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(this::toCard)
                .getContent();
    }

    @GetMapping("/recipes/{id}")
    public RecipeCardDto getOne(@PathVariable Long id) {
        Recipe r = recipeRepo.findById(id).orElseThrow();
        return toCard(r);
    }

    // --- 가벼운 카드 DTO로 반환: 프런트는 id/title/createdAt 정도만 씀 ---
    private RecipeCardDto toCard(Recipe r) {
        return new RecipeCardDto(
                r.getId(),
                cleanTitle(r.getTitle()),
                r.getCreatedAt(),
                0,  // 👍 필요하면 좋아요 집계 연결
                0,  // 💬 필요하면 댓글 집계 연결
                null // 대표이미지 컬럼이 있으면 채우세요 (e.g. r.getRepImageUrl())
        );
    }

    // 제목에 플레이스홀더가 섞인 데이터 방어용(선택)
    private String cleanTitle(String t) {
        if (t == null) return null;
        String x = t.replaceAll("^\\s*[?]?[\\(\\[]?제목을\\s*실제로\\s*넣으세요.*?[)\\]]?\\s*", "");
        return x.isBlank() ? "레시피" : x.trim();
    }

    private RecommendResponse fallbackRecipe(RecommendRequest req, String reason) {
        List<String> goals = Optional.ofNullable(req).map(RecommendRequest::goalsNormalized).orElseGet(List::of);
        return RecommendResponse.builder()
                .id(0L)
                .title("임시 레시피 (폴백)")
                .summary(reason + " — 입력 재료와 목표를 참고한 간단 레시피입니다.")
                .kcal(420).carbs_g(35).protein_g(32).fat_g(12).sodium_mg(520).cook_time_min(15)
                .ingredients_list(List.of(
                        "닭가슴살 150 g","양파 1/2개","파 10 cm","올리브유 1작은술","저염 간장 1작은술(선택)",
                        "후추 약간","물 50 ml(선택)"
                ))
                .steps(List.of(
                        "양파·파 손질","닭가슴살 굽기","양파·파 볶기","물/간장 넣고 졸이기","마무리"
                ))
                .tips("두부/버섯으로 대체 가능, 저염/저당 팁 포함")
                .goals(goals)
                .build();
    }

}