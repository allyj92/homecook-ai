package com.homecook.ai_recipe.config;

import com.homecook.ai_recipe.domain.*;
import com.homecook.ai_recipe.repo.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.*;
import java.util.List;

@Configuration
public class DataSeeder {

    @Bean
    CommandLineRunner seed(RecipeRepository recipeRepo, IngredientRepository ingRepo) {
        return args -> {
            if (recipeRepo.count() > 0) return;

            Ingredient chicken = saveIng(ingRepo, "닭가슴살");
            Ingredient tofu    = saveIng(ingRepo, "두부");
            Ingredient paprika = saveIng(ingRepo, "파프리카");

            Recipe r1 = make("저당 닭가슴살 강정", "단백질 위주, 당 저감",
                    330, 25, 38, 8, 500, 18,
                    List.of("닭 손질/밑간", "팬에 굽기", "파프리카 볶기", "저당 소스에 버무리기"),
                    "소스는 미리 계량하면 당 조절 쉬워요.");
            link(r1, chicken, "150g", 3); link(r1, paprika, "1/2개", 1);

            Recipe r2 = make("두부 스테이크 샐러드", "가벼운 저지방 한 끼",
                    300, 20, 28, 9, 420, 15,
                    List.of("두부 수분 제거", "겉면 바삭하게 굽기", "샐러드+드레싱"),
                    null);
            link(r2, tofu, "200g", 3);

            recipeRepo.saveAll(List.of(r1, r2));
        };
    }

    private Ingredient saveIng(IngredientRepository repo, String name) {
        return repo.findByName(name).orElseGet(() -> {
            Ingredient i = new Ingredient(); i.setName(name); return repo.save(i);
        });
    }
    private void link(Recipe r, Ingredient i, String amount, int weight) {
        RecipeIngredient ri = new RecipeIngredient();
        ri.setRecipe(r); ri.setIngredient(i); ri.setAmount(amount); ri.setWeight(weight);
        r.getIngredients().add(ri);
    }
    private Recipe make(String t, String s,
                        Integer kcal, Integer carbs, Integer protein, Integer fat, Integer sodium, Integer min,
                        List<String> steps, String tips) {
        Recipe r = new Recipe();
        r.setTitle(t); r.setSummary(s);
        r.setKcal(kcal); r.setCarbsG(carbs); r.setProteinG(protein); r.setFatG(fat);
        r.setSodiumMg(sodium); r.setCookTimeMin(min);
        r.setSteps(steps); r.setTips(tips);
        return r;
    }
}