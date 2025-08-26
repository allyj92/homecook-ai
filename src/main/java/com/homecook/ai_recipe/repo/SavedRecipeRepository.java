// src/main/java/com/homecook/ai_recipe/repo/SavedRecipeRepository.java
package com.homecook.ai_recipe.repo;

import com.homecook.ai_recipe.auth.UserAccount;
import com.homecook.ai_recipe.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SavedRecipeRepository extends JpaRepository<SavedRecipe, Long> {
    boolean existsByUserAndRecipe(UserAccount user, Recipe recipe);
    Optional<SavedRecipe> findByUserAndRecipe(UserAccount user, Recipe recipe);
    List<SavedRecipe> findByUserOrderBySavedAtDesc(UserAccount user);
}
