package com.homecook.ai_recipe.dto;

import java.util.List;


public record ActivityPageRes(
     List<ActivityRes> content,
     long totalElements
 ) {}