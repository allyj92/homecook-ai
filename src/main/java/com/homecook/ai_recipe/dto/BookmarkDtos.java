package com.homecook.ai_recipe.dto;

import java.time.LocalDateTime;

public class BookmarkDtos {

    // POST /api/mypage/bookmarks  요청 바디
    // A안: recipeId만 필수. recipeJson은 선택(캐시용으로 저장하고 싶으면 문자열로 넘길 때만)
    public record AddReq(Long recipeId, String recipeJson) {}

    // DELETE /api/mypage/bookmarks  요청 바디
    public record RemoveReq(Long recipeId) {}

    // GET 응답 아이템 (필요에 따라 확장)
    public record Item(Long recipeId,
                       LocalDateTime createdAt,
                       String recipeJson) {}
}
