package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.domain.Ingredient;
import com.homecook.ai_recipe.domain.Recipe;
import com.homecook.ai_recipe.domain.RecipeIngredient;
import com.homecook.ai_recipe.dto.RecommendRequest;
import com.homecook.ai_recipe.dto.RecommendResponse;
import com.homecook.ai_recipe.repo.RecipeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RecipeService {

    private final RecipeRepository recipeRepo;


    /* ===================== Public APIs ===================== */

    /**
     * 단일 추천 (이미 본 레시피 제외 가능)
     */
    @Transactional(readOnly = true)
    public RecommendResponse recommend(RecommendRequest r) {
        // 입력 파싱
        String ingRaw = r != null ? r.getIngredients() : null;
        Set<String> tokens = tokenizeIngredients(ingRaw);
        Set<Long> exclude = Optional.ofNullable(r != null ? r.getExcludeIds() : null)
                .map(HashSet::new).orElseGet(HashSet::new);

        // DB가 비어 있으면 임시 폴백
        if (recipeRepo.count() == 0) {
            return RecommendResponse.builder()
                    .id(null)
                    .title("임시 레시피 (시드 준비 전)")
                    .summary("DB에 레시피가 없어 임시 응답을 반환했습니다.")
                    .kcal(320).carbs_g(30).protein_g(28).fat_g(9).sodium_mg(500).cook_time_min(15)
                    .ingredients_list(List.of("입력 재료 기반 임시 재료"))
                    .steps(List.of("재료 손질", "단백질 조리", "채소 추가", "간 맞추기"))
                    .tips("DataSeeder를 추가하면 실제 추천이 제공됩니다.")
                    .goals(r != null ? r.goalsNormalized() : List.of())
                    .build();
        }

        // 후보 선정(제외 반영)
        Recipe best = pickBestRecipeByIngredients(tokens, exclude);
        List<String> goalsNorm = normalizeGoals(r);

        return applyGoalsAndBuild(best, goalsNorm);
    }

    /**
     * Top-N 추천 (이미 본 레시피 제외 반영)
     */
    @Transactional(readOnly = true)
    public List<RecommendResponse> recommendTopN(RecommendRequest r, int n) {
        Set<String> tokens = tokenizeIngredients(r != null ? r.getIngredients() : null);
        Set<Long> exclude = Optional.ofNullable(r != null ? r.getExcludeIds() : null)
                .map(HashSet::new).orElseGet(HashSet::new);

        List<Recipe> all = recipeRepo.findAll();
        if (all.isEmpty()) {
            return List.of(
                    RecommendResponse.builder()
                            .id(null)
                            .title("임시 레시피 (시드 필요)")
                            .summary("DB에 레시피가 없어 임시 응답을 반환했습니다.")
                            .kcal(320).carbs_g(30).protein_g(28).fat_g(9).sodium_mg(500).cook_time_min(15)
                            .ingredients_list(List.of("입력 재료 기반 임시 재료"))
                            .steps(List.of("재료 손질","볶기","간 맞추기"))
                            .goals(r != null ? r.goalsNormalized() : List.of())
                            .build()
            );
        }

        // 점수 계산
        record Scored(Recipe recipe, int score) {}
        List<Scored> scored = new ArrayList<>();
        for (Recipe recipe : all) {
            int score = 0;
            for (RecipeIngredient ri : Optional.ofNullable(recipe.getIngredients())
                    .orElseGet(Collections::emptyList)) {
                String ingName = Optional.ofNullable(ri.getIngredient())
                        .map(Ingredient::getName).orElse("")
                        .toLowerCase().replace(" ", "");
                boolean matched = tokens.stream().anyMatch(t -> ingName.contains(t) || t.contains(ingName));
                if (matched) score += Math.max(1, Math.max(0, ri.getWeight()));
            }
            scored.add(new Scored(recipe, score));
        }

        // 정렬: 점수 내림차순 → 동점 시 조리시간 짧은 순
        scored.sort((a, b) -> {
            if (b.score != a.score) return Integer.compare(b.score, a.score);
            int ta = orDefault(a.recipe.getCookTimeMin(), 999);
            int tb = orDefault(b.recipe.getCookTimeMin(), 999);
            return Integer.compare(ta, tb);
        });

        // 제외 반영하여 상위 N개 추출
        List<RecommendResponse> out = new ArrayList<>();
        List<String> goalsNorm = normalizeGoals(r);
        int limit = Math.max(1, n);

        for (Scored s : scored) {
            if (out.size() >= limit) break;
            if (exclude.contains(s.recipe.getId())) continue;
            out.add(applyGoalsAndBuild(s.recipe, goalsNorm));
        }

        // 전부 제외되어 비면 최소 1개 반환(루프 방지 정책)
        if (out.isEmpty() && !scored.isEmpty()) {
            out.add(applyGoalsAndBuild(scored.get(0).recipe, goalsNorm));
        }

        return out;
    }

    /* ===================== Core Helpers ===================== */

    /**
     * 재료 토큰화: "닭가슴살, 파프리카/양파" → {"닭가슴살","파프리카","양파"}
     */
    private Set<String> tokenizeIngredients(String ingredients) {
        if (!StringUtils.hasText(ingredients)) return Collections.emptySet();
        return Arrays.stream(ingredients.toLowerCase()
                        .replace(" ", "")
                        .split("[,·|/]+"))
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());
    }

    /**
     * 제외 목록을 고려하여 최적 레시피 1개 선택
     */
    private Recipe pickBestRecipeByIngredients(Set<String> tokens, Set<Long> excludeIds) {
        List<Recipe> all = recipeRepo.findAll();
        if (all.isEmpty()) throw new IllegalStateException("레시피 데이터가 없습니다. (seed 필요)");

        Recipe best = null;
        int bestScore = Integer.MIN_VALUE;

        for (Recipe recipe : all) {
            if (excludeIds != null && excludeIds.contains(recipe.getId())) continue;

            int score = 0;
            for (RecipeIngredient ri : Optional.ofNullable(recipe.getIngredients())
                    .orElseGet(Collections::emptyList)) {
                String ingName = Optional.ofNullable(ri.getIngredient())
                        .map(Ingredient::getName).orElse("")
                        .toLowerCase().replace(" ", "");
                boolean matched = tokens.stream().anyMatch(t ->
                        ingName.contains(t) || t.contains(ingName));
                if (matched) score += Math.max(1, Math.max(0, ri.getWeight()));
            }

            // 동점이면 조리시간 짧은 후보 선호
            if (score > bestScore ||
                    (score == bestScore &&
                            orDefault(recipe.getCookTimeMin(), 999) <
                                    orDefault(best != null ? best.getCookTimeMin() : null, 999))) {
                bestScore = score;
                best = recipe;
            }
        }

        // 전부 제외로 인해 best가 없으면 제외 없이 다시 시도
        if (best == null) return pickBestRecipeByIngredients(tokens, Collections.emptySet());
        return best;
    }

    /**
     * 목표(goals)를 적용해 영양/시간 보정 후 응답 빌드
     */
    private RecommendResponse applyGoalsAndBuild(Recipe best, List<String> goalsNorm) {
        int kcal    = orDefault(best.getKcal(), 380);
        int carbs   = orDefault(best.getCarbsG(), 35);
        int protein = orDefault(best.getProteinG(), 35);
        int fat     = orDefault(best.getFatG(), 10);
        int sodium  = orDefault(best.getSodiumMg(), 600);
        int minutes = orDefault(best.getCookTimeMin(), 17);

        for (String g : goalsNorm) {
            switch (g) {
                case "diet" -> { kcal = (int)(kcal * 0.85); fat = (int)(fat * 0.85); }
                case "low_sodium", "lowsalt", "low-salt" -> sodium = (int)(sodium * 0.60);
                case "low_sugar", "lowsugar", "low-sugar" -> { carbs = (int)(carbs * 0.70); kcal = (int)(kcal * 0.90); }
                case "highprotein", "high_protein" -> protein = Math.max(protein, (int)Math.ceil(protein * 1.25));
                case "bulk" -> { kcal = (int)(kcal * 1.15); protein = (int)(protein * 1.15); }
                case "quick", "15min", "15분", "fast" -> minutes = Math.min(minutes, 15);
                // 확장 포인트: vegan, gluten_free 등
                default -> {}
            }
        }

        // 안전 클램핑
        kcal    = clamp(kcal, 120, 2000);
        carbs   = clamp(carbs, 0, 350);
        protein = clamp(protein, 0, 250);
        fat     = clamp(fat, 0, 200);
        sodium  = clamp(sodium, 50, 4000);
        minutes = clamp(minutes, 1, 180);

        // 재료/단계 문자열화
        List<String> ingList = Optional.ofNullable(best.getIngredients())
                .orElseGet(Collections::emptyList)
                .stream()
                .map(ri -> {
                    String name = Optional.ofNullable(ri.getIngredient())
                            .map(Ingredient::getName).orElse("재료");
                    String amount = Optional.ofNullable(ri.getAmount()).orElse("");
                    return amount.isBlank() ? name : (name + " " + amount);
                })
                .toList();

        List<String> steps = Optional.ofNullable(best.getSteps())
                .orElseGet(() -> List.of("재료 손질", "단백질 조리", "채소 추가", "간 맞추기"));

        return RecommendResponse.builder()
                .id(best.getId()) // ← 프론트에서 excludeIds로 쓰기 위해 ID 포함
                .title(Optional.ofNullable(best.getTitle()).orElse("추천 레시피"))
                .summary(Optional.ofNullable(best.getSummary()).orElse("입력 재료와 목표를 반영한 추천 레시피"))
                .kcal(kcal).carbs_g(carbs).protein_g(protein).fat_g(fat).sodium_mg(sodium).cook_time_min(minutes)
                .ingredients_list(ingList)
                .steps(steps)
                .tips(best.getTips())
                .goals(goalsNorm)
                .build();
    }

    /**
     * 목표 리스트 정규화
     */
    private List<String> normalizeGoals(RecommendRequest r) {
        if (r == null) return List.of();
        List<String> src = r.goalsNormalized();
        if (src.isEmpty()) return List.of();
        return src.stream()
                .filter(StringUtils::hasText)
                .map(s -> s.trim().toLowerCase())
                .collect(Collectors.toList());
    }

    /* ===================== Misc Utils ===================== */

    private static int orDefault(Integer v, int d) { return v == null ? d : v; }

    private static int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }
}