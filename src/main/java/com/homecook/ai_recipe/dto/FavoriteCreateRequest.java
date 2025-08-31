// src/main/java/com/homecook/ai_recipe/dto/FavoriteCreateRequest.java
package com.homecook.ai_recipe.dto;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class FavoriteCreateRequest {
    private String title;
    private String summary;
    private String image;
    private String meta;
}
