// src/main/java/com/homecook/ai_recipe/domain/PostRes.java
package com.homecook.ai_recipe.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PostRes {

    private Long id;
    private String title;
    private String category;
    private String content;
    private List<String> tags;

    private Long authorId;
    private String authorName;    // 화면용 닉네임(없으면 "작성자#<id>")
    private String authorAvatar;  // 작성자 아바타 URL
    private String authorHandle;  // @아이디 (email 앞부분 등)

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private String youtubeId;
    private String repImageUrl;

    // ✅ 추가: 집계 값 (프런트가 읽는 키)
    private Integer likeCount;      // 해당 글의 총 좋아요 수
    private Integer commentCount;   // 해당 글의 총 댓글 수(삭제 제외)
    private Integer bookmarkCount;  // 해당 글의 총 북마크 수
}
