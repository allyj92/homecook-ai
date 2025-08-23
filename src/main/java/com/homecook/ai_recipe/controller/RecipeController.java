// src/main/java/com/homecook/ai_recipe/controller/RecipeController.java
package com.homecook.ai_recipe.controller;

import com.homecook.ai_recipe.dto.ApiError;
import com.homecook.ai_recipe.dto.RecommendRequest;
import com.homecook.ai_recipe.dto.RecommendResponse;
import com.homecook.ai_recipe.service.RecipeAiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class RecipeController {

    private final RecipeAiService ai;

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
            // 👇 실패 시 폴백 (DB 혹은 임시)
            var fb = fallbackRecipe(req, "AI 호출 실패로 임시 레시피를 제공합니다.");
            System.out.println("[API] served_by=FALLBACK title=" + fb.getTitle());
            return ResponseEntity.ok(fb);
        }
    }

    @GetMapping("/ping")
    public String ping() { return "pong"; }

    private RecommendResponse fallbackRecipe(RecommendRequest req, String reason) {
        List<String> goals = Optional.ofNullable(req).map(RecommendRequest::goalsNormalized).orElseGet(List::of);
        return RecommendResponse.builder()
                .id(0L)
                .title("임시 레시피 (폴백)")
                .summary(reason + " — 입력 재료와 목표를 참고한 간단 레시피입니다.")
                .kcal(420).carbs_g(35).protein_g(32).fat_g(12).sodium_mg(520).cook_time_min(15)
                .ingredients_list(List.of(
                        "닭가슴살 150 g", "양파 1/2개", "파 10 cm", "올리브유 1작은술", "저염 간장 1작은술 (선택)",
                        "후추 약간", "물 50 ml (선택)"
                ))
                .steps(List.of(
                        "양파와 파는 어슷 썰고, 닭가슴살은 키친타월로 물기를 제거한다.",
                        "중불 팬에 올리브유를 두르고 닭가슴살을 2~3분씩 양면 노릇하게 굽는다.",
                        "양파·파를 넣고 1~2분 볶아 향을 낸 뒤, 물 50 ml를 넣어 약불로 1분 졸인다.",
                        "저염 간장과 후추로 간을 맞추고, 소스 점성이 생기면 불을 끈다.",
                        "먹기 좋게 썰어 접시에 담고, 기호에 따라 고춧가루·참깨를 약간 뿌린다."
                ))
                .tips(String.join("\n",
                        "닭 대신 두부·버섯으로 대체 가능(비건 지향).",
                        "저염이 목표라면 간장 양을 줄이고 다시마물로 감칠맛 보완.",
                        "저당이 목표라면 설탕·시럽은 사용하지 말고, 양파를 충분히 볶아 자연 단맛을 살리세요."
                ))
                .goals(goals)
                .build();
    }
}