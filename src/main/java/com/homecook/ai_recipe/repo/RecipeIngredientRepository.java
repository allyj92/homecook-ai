package com.homecook.ai_recipe.repo;
import com.homecook.ai_recipe.domain.RecipeIngredient;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecipeIngredientRepository extends JpaRepository<RecipeIngredient, Long> {}