package com.homecook.ai_recipe.domain;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@AllArgsConstructor
public class PostRes {
    private Long id;
    private String title;
    private String category;
    private String content;
    private List<String> tags;

    private Long authorId;
    private String authorName;    // ✅ 추가: 화면에 표시할 닉네임(없으면 "작성자#<id>")
    private String authorAvatar;  // ✅ 추가: 작성자 아바타 URL
    private String authorHandle;  // ✅ 추가: @아이디 (email 앞부분 등)

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private String youtubeId;
    private String repImageUrl;
}
